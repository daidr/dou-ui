import type { Node as PMNode, NodeType, Schema } from 'prosemirror-model'
import * as Y from 'yjs'
import {
  createId,
  inlineOf,
  type BlockProps,
  type PartialTableRow,
  type RowsSpec,
  type TableGrid,
} from '../core/model'
import { orderKeys } from './order'
import { inlineFrom, insertInline, updateText } from './text'

/*
 * How a table is stored: rows, columns, cells and merged cells apart, so
 * that edits made at the same time merge instead of overwriting each other.
 *
 *   rows:    Y.Map<row id, Y.Map { order }>
 *   columns: Y.Map<column id, Y.Map { order, width?, align? }>
 *   cells:   Y.Map<"row id:column id", Y.Text>
 *   merges:  Y.Map<merge id, { rows: string[], columns: string[] }>
 *
 * Moving a row only changes its order key, so text typed into its cells
 * meanwhile stays with it. A merged cell lists the rows and columns it
 * covered when it was made, and spans from the first to the last of them
 * that still exist in the current order: a row inserted inside it falls
 * inside, and deleting its edge row shrinks it. Merged cells that overlap
 * are settled by id, the same way on every client.
 */

type YEntry = Y.Map<unknown>

const PARTS = ['rows', 'columns', 'cells', 'merges'] as const

const cellKey = (row: string, column: string) => `${row}:${column}`

interface StoredMerge {
  rows: string[]
  columns: string[]
}

interface Rect {
  id: string
  top: number
  left: number
  bottom: number
  right: number
}

const rectKey = (rect: Omit<Rect, 'id'>) => `${rect.top},${rect.left},${rect.bottom},${rect.right}`

function part<T>(yblock: YEntry, name: (typeof PARTS)[number]): Y.Map<T> {
  let map = yblock.get(name) as Y.Map<T> | undefined
  if (!map) {
    map = new Y.Map<T>()
    yblock.set(name, map)
  }
  return map
}

/** Ids by their order key; ties by id. */
function ordered(map: Y.Map<YEntry> | undefined): string[] {
  if (!map) return []
  const orderOf = (id: string) => (map.get(id)!.get('order') as string | undefined) ?? ''
  // oxlint-disable-next-line unicorn/no-array-sort -- sorts a fresh array
  return Array.from(map.keys()).sort((a, b) => {
    const x = orderOf(a)
    const y = orderOf(b)
    return x < y ? -1 : x > y ? 1 : a < b ? -1 : a > b ? 1 : 0
  })
}

/** The first and past-the-last index of the ids that still exist. */
function span(ids: unknown, index: Map<string, number>): [number, number] | null {
  let low = Infinity
  let high = -1
  for (const id of Array.isArray(ids) ? ids : []) {
    const at = index.get(id as string)
    if (at === undefined) continue
    low = Math.min(low, at)
    high = Math.max(high, at)
  }
  return high < 0 ? null : [low, high + 1]
}

/** Where the merged cells are in the current order; overlapping ones lose by id. */
function mergeRects(merges: Y.Map<StoredMerge> | undefined, rows: string[], columns: string[]) {
  const rects: Rect[] = []
  if (!merges) return rects
  const rowIndex = new Map(rows.map((id, index) => [id, index]))
  const colIndex = new Map(columns.map((id, index) => [id, index]))
  // oxlint-disable-next-line unicorn/no-array-sort -- sorts a fresh array
  for (const id of Array.from(merges.keys()).sort()) {
    const merge = merges.get(id)!
    const vertical = span(merge.rows, rowIndex)
    const horizontal = span(merge.columns, colIndex)
    if (!vertical || !horizontal) continue
    const rect = {
      id,
      top: vertical[0]!,
      bottom: vertical[1]!,
      left: horizontal[0]!,
      right: horizontal[1]!,
    }
    if ((rect.bottom - rect.top) * (rect.right - rect.left) < 2) continue
    const overlaps = rects.some(
      (other) =>
        rect.top < other.bottom &&
        other.top < rect.bottom &&
        rect.left < other.right &&
        other.left < rect.right,
    )
    if (!overlaps) rects.push(rect)
  }
  return rects
}

const textToInline = (text: Y.Text | undefined, schema: Schema) =>
  text?.length
    ? inlineOf(schema.nodes.paragraph!.create(null, inlineFrom(text, schema, false)))
    : []

/** The table node a stored table stands for. */
export function readTable(yblock: YEntry, type: NodeType, props: BlockProps): PMNode {
  const spec = type.spec.rows as RowsSpec
  const rowsMap = yblock.get('rows') as Y.Map<YEntry> | undefined
  const colsMap = yblock.get('columns') as Y.Map<YEntry> | undefined
  const cells = yblock.get('cells') as Y.Map<Y.Text> | undefined
  const rowIds = ordered(rowsMap)
  const colIds = ordered(colsMap)
  if (!rowIds.length || !colIds.length) return spec.write(type, props, [])
  const columns = colIds.map((id) => {
    const { order: _order, ...fields } = colsMap!.get(id)!.toJSON()
    return { ...fields, id }
  })
  const spans = new Map<string, Rect>()
  for (const rect of mergeRects(yblock.get('merges') as Y.Map<StoredMerge>, rowIds, colIds))
    spans.set(`${rect.top},${rect.left}`, rect)
  const rows: PartialTableRow[] = rowIds.map((row, r) => ({
    id: row,
    cells: colIds.map((col, c) => {
      const rect = spans.get(`${r},${c}`)
      return {
        content: textToInline(cells?.get(cellKey(row, col)), type.schema),
        colspan: rect ? rect.right - rect.left : 1,
        rowspan: rect ? rect.bottom - rect.top : 1,
      }
    }),
  }))
  return spec.write(type, { ...props, columns }, rows)
}

/** Bring a list of ids (rows or columns) in the map to `ids`, in that order. */
function writeOrder(map: Y.Map<YEntry>, before: string[], ids: string[]) {
  const kept = new Set(ids)
  for (const id of before) if (!kept.has(id)) map.delete(id)
  const keys = ids.map((id) => (map.get(id)?.get('order') as string | undefined) ?? null)
  const next = orderKeys(keys)
  ids.forEach((id, index) => {
    let entry = map.get(id)
    if (!entry) {
      entry = new Y.Map<unknown>()
      map.set(id, entry)
    }
    if (keys[index] !== next[index]) entry.set('order', next[index])
  })
}

/**
 * Write the table `after` into a stored table that holds `before` (`null`
 * for a new one). Returns whether cells that became visible hold text the
 * editor doesn't show yet, typed by someone else while they were merged away.
 */
export function writeTable(yblock: YEntry, before: PMNode | null, after: PMNode): boolean {
  const spec = after.type.spec.rows as RowsSpec
  const grid = spec.grid(after)
  const old: TableGrid | null = before ? spec.grid(before) : null

  let props = yblock.get('props') as Y.Map<unknown> | undefined
  if (!props) {
    props = new Y.Map<unknown>()
    yblock.set('props', props)
  }
  for (const [name, value] of Object.entries(grid.props))
    if (JSON.stringify(props.get(name)) !== JSON.stringify(value)) props.set(name, value)
  for (const name of Array.from(props.keys())) if (!(name in grid.props)) props.delete(name)

  const rowsMap = part<YEntry>(yblock, 'rows')
  const colsMap = part<YEntry>(yblock, 'columns')
  const cells = part<Y.Text>(yblock, 'cells')
  const merges = part<StoredMerge>(yblock, 'merges')
  const colIds = grid.columns.map((column) => column.id)
  const oldCols = old ? old.columns.map((column) => column.id) : []
  const oldRows = old?.rows ?? []

  writeOrder(rowsMap, oldRows, grid.rows)
  writeOrder(colsMap, oldCols, colIds)
  for (const column of grid.columns) {
    const entry = colsMap.get(column.id)!
    for (const [name, value] of Object.entries(column) as [string, unknown][]) {
      if (name === 'id') continue
      if (JSON.stringify(entry.get(name)) !== JSON.stringify(value)) entry.set(name, value)
    }
    for (const name of Array.from(entry.keys()))
      if (name !== 'order' && !(name in column)) entry.delete(name)
  }

  // the cells of deleted rows and columns go with them
  const allRows = new Set([...oldRows, ...rowsMap.keys()])
  const allCols = new Set([...oldCols, ...colsMap.keys()])
  for (const row of oldRows)
    if (!rowsMap.has(row)) for (const col of allCols) cells.delete(cellKey(row, col))
  for (const col of oldCols)
    if (!colsMap.has(col)) for (const row of allRows) cells.delete(cellKey(row, col))

  // merged cells: keep the stored ones still shown, add the new ones
  const stored = mergeRects(merges, grid.rows, colIds)
  const shown = new Set(stored.map(rectKey))
  const wanted = new Set<string>()
  const created: string[] = []
  for (const cell of grid.cells) {
    if (cell.rowspan * cell.colspan < 2) continue
    const rect = {
      top: cell.row,
      left: cell.col,
      bottom: cell.row + cell.rowspan,
      right: cell.col + cell.colspan,
    }
    const key = rectKey(rect)
    wanted.add(key)
    if (shown.has(key)) continue
    const id = createId()
    created.push(id)
    merges.set(id, {
      rows: grid.rows.slice(rect.top, rect.bottom),
      columns: colIds.slice(rect.left, rect.right),
    })
    // merging moved the covered cells' text into this one
    for (let r = rect.top; r < rect.bottom; r++) {
      for (let c = rect.left; c < rect.right; c++) {
        if (r === rect.top && c === rect.left) continue
        const text = cells.get(cellKey(grid.rows[r]!, colIds[c]!))
        if (text?.length) text.delete(0, text.length)
      }
    }
  }
  const kept = new Set(created)
  for (const rect of stored) if (wanted.has(rectKey(rect))) kept.add(rect.id)
  for (const id of Array.from(merges.keys())) if (!kept.has(id)) merges.delete(id)

  // cell text
  const oldCells = new Map<string, PMNode>()
  for (const cell of old?.cells ?? [])
    oldCells.set(cellKey(old!.rows[cell.row]!, oldCols[cell.col]!), cell.node)
  let revealed = false
  for (const cell of grid.cells) {
    const key = cellKey(grid.rows[cell.row]!, colIds[cell.col]!)
    const node = cell.node
    let text = cells.get(key)
    if (!text) {
      text = new Y.Text()
      cells.set(key, text)
      insertInline(text, 0, node, 0, node.content.size)
      continue
    }
    const previous = oldCells.get(key)
    if (previous) {
      if (previous !== node && !previous.content.eq(node.content)) updateText(text, previous, node)
    } else if (node.content.size) {
      // shown again or reused: the editor's content wins
      text.delete(0, text.length)
      insertInline(text, 0, node, 0, node.content.size)
    } else if (text.length) {
      revealed = true
    }
  }
  return revealed
}

/** Forget a stored table's rows, e.g. when the block stops being a table. */
export function clearTable(yblock: YEntry) {
  for (const name of PARTS) if (yblock.has(name)) yblock.delete(name)
}

/** The cell a position in a table falls in, and the offset in its text. */
export function cellAt(table: PMNode, offset: number): { key: string; index: number } | null {
  const grid = (table.type.spec.rows as RowsSpec).grid(table)
  for (const cell of grid.cells) {
    if (offset > cell.offset && offset < cell.offset + cell.node.nodeSize) {
      const column = grid.columns[cell.col]!.id
      return { key: cellKey(grid.rows[cell.row]!, column), index: offset - cell.offset - 1 }
    }
  }
  return null
}

/** Where a cell's text starts in a table, by its key; `null` when it isn't shown. */
export function cellStart(table: PMNode, key: string): { offset: number; size: number } | null {
  const grid = (table.type.spec.rows as RowsSpec).grid(table)
  for (const cell of grid.cells) {
    if (cellKey(grid.rows[cell.row]!, grid.columns[cell.col]!.id) === key)
      return { offset: cell.offset + 1, size: cell.node.content.size }
  }
  return null
}
