import type { Node as PMNode, ResolvedPos } from 'prosemirror-model'
import { TextSelection, type Command, type EditorState, type Transaction } from 'prosemirror-state'
import {
  addColumn,
  addRow,
  CellSelection,
  cellAround,
  deleteCellSelection,
  isInTable,
  removeColumn,
  removeRow,
  selectedRect,
  selectionCell,
  splitCell,
  TableMap,
  type TableRect,
} from 'prosemirror-tables'
import { createId } from '../../core/model'
import { fitColumns, tableRows, type TableAlign } from './schema'

/** The table around the selection: its node, position and grid. */
export interface TableAt {
  node: PMNode
  /** Position right before the table node. */
  pos: number
  map: TableMap
}

export function tableAt($pos: ResolvedPos): TableAt | null {
  for (let depth = $pos.depth; depth > 0; depth--) {
    const node = $pos.node(depth)
    if (node.type.spec.tableRole === 'table')
      return { node, pos: $pos.before(depth), map: TableMap.get(node) }
  }
  return null
}

const columnsOf = (rect: TableRect) => fitColumns(rect.table.attrs.columns, rect.map.width)

/* rows and columns */

/** Add a column before or after the selected ones. */
export function insertColumn(side: 'before' | 'after'): Command {
  return (state, dispatch) => {
    if (!isInTable(state)) return false
    if (dispatch) {
      const rect = selectedRect(state)
      const at = side === 'before' ? rect.left : rect.right
      const columns = columnsOf(rect)
      columns.splice(at, 0, { id: createId() })
      const tr = addColumn(state.tr, rect, at)
      dispatch(tr.setNodeAttribute(rect.tableStart - 1, 'columns', columns))
    }
    return true
  }
}

/** Add a row above or below the selected ones. */
export function insertRow(side: 'before' | 'after'): Command {
  return (state, dispatch) => {
    if (!isInTable(state)) return false
    if (dispatch) {
      const rect = selectedRect(state)
      dispatch(addRow(state.tr, rect, side === 'before' ? rect.top : rect.bottom))
    }
    return true
  }
}

/** Remove the selected columns; not all of them (that is deleting the table). */
export const deleteColumns: Command = (state, dispatch) => {
  if (!isInTable(state)) return false
  const rect = selectedRect(state)
  if (rect.left === 0 && rect.right === rect.map.width) return false
  if (dispatch) {
    const tr = state.tr
    const columns = columnsOf(rect)
    for (let col = rect.right - 1; col >= rect.left; col--) {
      removeColumn(tr, rect, col)
      // the next column to the left is read from the changed table
      const table = tr.doc.nodeAt(rect.tableStart - 1)!
      rect.table = table
      rect.map = TableMap.get(table)
    }
    columns.splice(rect.left, rect.right - rect.left)
    dispatch(tr.setNodeAttribute(rect.tableStart - 1, 'columns', columns))
  }
  return true
}

/** Remove the selected rows; not all of them. */
export const deleteRows: Command = (state, dispatch) => {
  if (!isInTable(state)) return false
  const rect = selectedRect(state)
  if (rect.top === 0 && rect.bottom === rect.map.height) return false
  if (dispatch) {
    const tr = state.tr
    for (let row = rect.bottom - 1; row >= rect.top; row--) {
      removeRow(tr, rect, row)
      const table = tr.doc.nodeAt(rect.tableStart - 1)!
      rect.table = table
      rect.map = TableMap.get(table)
    }
    dispatch(tr)
  }
  return true
}

/**
 * Where rows (or columns) can be cut: the boundaries no merged cell
 * crosses. A run of rows between two of them moves as one.
 */
export function boundaries(map: TableMap, axis: 'row' | 'column'): number[] {
  const size = axis === 'row' ? map.height : map.width
  const crossed = new Set<number>()
  const seen = new Set<number>()
  for (const pos of map.map) {
    if (seen.has(pos)) continue
    seen.add(pos)
    const rect = map.findCell(pos)
    const [from, to] = axis === 'row' ? [rect.top, rect.bottom] : [rect.left, rect.right]
    for (let index = from + 1; index < to; index++) crossed.add(index)
  }
  const result: number[] = []
  for (let index = 0; index <= size; index++) if (!crossed.has(index)) result.push(index)
  return result
}

/** The run of rows (or columns) that holds `[from, to)` and can move as one. */
export function band(map: TableMap, axis: 'row' | 'column', from: number, to: number) {
  const cuts = boundaries(map, axis)
  let start = 0
  let end = cuts.at(-1)!
  for (const cut of cuts) {
    if (cut <= from) start = cut
    if (cut >= to) {
      end = cut
      break
    }
  }
  return { start, end, cuts }
}

/**
 * Move the selected rows (or columns), with any merged cells they belong
 * to, one step up or down (left or right). Ids, widths and alignment move
 * along.
 */
export function moveLines(axis: 'row' | 'column', direction: -1 | 1): Command {
  return (state, dispatch) => {
    if (!isInTable(state)) return false
    const rect = selectedRect(state)
    const [from, to] = axis === 'row' ? [rect.top, rect.bottom] : [rect.left, rect.right]
    const { start, end, cuts } = band(rect.map, axis, from, to)
    const other = cuts[cuts.indexOf(direction < 0 ? start : end) + direction]
    if (other === undefined) return false
    return moveLinesTo(rect.tableStart - 1, axis, start, end, other)(state, dispatch)
  }
}

/**
 * Move rows (or columns) `[start, end)` of the table at `tablePos` to the
 * boundary `to`, given as the index of the line they go before. Both the
 * run and `to` have to be on boundaries no merged cell crosses.
 */
export function moveLinesTo(
  tablePos: number,
  axis: 'row' | 'column',
  start: number,
  end: number,
  to: number,
): Command {
  return (state, dispatch) => {
    const table = state.doc.nodeAt(tablePos)
    if (!table || table.type.spec.tableRole !== 'table') return false
    const map = TableMap.get(table)
    const cuts = boundaries(map, axis)
    if (start >= end || !cuts.includes(start) || !cuts.includes(end) || !cuts.includes(to))
      return false
    if (to >= start && to <= end) return false
    if (dispatch) {
      const order = Array.from({ length: axis === 'row' ? map.height : map.width }, (_, i) => i)
      const moved =
        to < start
          ? [
              ...order.slice(0, to),
              ...order.slice(start, end),
              ...order.slice(to, start),
              ...order.slice(end),
            ]
          : [
              ...order.slice(0, start),
              ...order.slice(end, to),
              ...order.slice(start, end),
              ...order.slice(to),
            ]
      const read = tableRows.read(table)
      const columns = read.props.columns as unknown[]
      const rows =
        axis === 'row'
          ? moved.map((i) => read.rows[i]!)
          : read.rows.map((row) => ({ ...row, cells: moved.map((i) => row.cells[i]!) }))
      const props =
        axis === 'row' ? read.props : { ...read.props, columns: moved.map((i) => columns[i]) }
      const rebuilt = tableRows.write(table.type, props, rows)
      const tr = state.tr.replaceWith(tablePos, tablePos + table.nodeSize, rebuilt)
      const first = to < start ? to : to - (end - start)
      selectLines(tr, tablePos, axis, first, first + end - start)
      dispatch(tr.scrollIntoView())
    }
    return true
  }
}

/** Select whole rows (or columns) `[from, to)` of the table at `tablePos`. */
export function selectLines(
  tr: Transaction,
  tablePos: number,
  axis: 'row' | 'column',
  from: number,
  to: number,
) {
  const table = tr.doc.nodeAt(tablePos)!
  const map = TableMap.get(table)
  const start = tablePos + 1
  const [anchor, head] =
    axis === 'row'
      ? [map.positionAt(from, 0, table), map.positionAt(to - 1, map.width - 1, table)]
      : [map.positionAt(0, from, table), map.positionAt(map.height - 1, to - 1, table)]
  const $anchor = tr.doc.resolve(start + anchor)
  const $head = tr.doc.resolve(start + head)
  tr.setSelection(
    axis === 'row'
      ? CellSelection.rowSelection($anchor, $head)
      : CellSelection.colSelection($anchor, $head),
  )
  return tr
}

/* cells */

/**
 * Merge the selected cells into the top-left one. Their text joins it,
 * each on a line of its own.
 */
export const mergeCells: Command = (state, dispatch) => {
  const selection = state.selection
  if (
    !(selection instanceof CellSelection) ||
    selection.$anchorCell.pos === selection.$headCell.pos
  )
    return false
  const rect = selectedRect(state)
  const { map, table, tableStart } = rect
  // a merged cell that reaches out of the selection can't be merged
  const seen = new Set<number>()
  const inside: number[] = []
  for (let row = rect.top; row < rect.bottom; row++) {
    for (let col = rect.left; col < rect.right; col++) {
      const pos = map.map[row * map.width + col]!
      if (seen.has(pos)) continue
      seen.add(pos)
      const cell = map.findCell(pos)
      if (
        cell.left < rect.left ||
        cell.right > rect.right ||
        cell.top < rect.top ||
        cell.bottom > rect.bottom
      )
        return false
      inside.push(pos)
    }
  }
  if (dispatch) {
    const tr = state.tr
    const [first, ...rest] = inside
    const target = table.nodeAt(first!)!
    const breakType = state.schema.nodes.hardBreak!
    const parts = [target, ...rest.map((pos) => table.nodeAt(pos)!)].filter(
      (cell) => cell.content.size,
    )
    const content: PMNode[] = []
    parts.forEach((cell, index) => {
      if (index) content.push(breakType.create())
      cell.content.forEach((child) => content.push(child))
    })
    // later cells first, so earlier positions stay valid
    for (let index = rest.length - 1; index >= 0; index--) {
      const pos = rest[index]!
      const cell = table.nodeAt(pos)!
      tr.delete(tableStart + pos, tableStart + pos + cell.nodeSize)
    }
    const widths = Array.from({ length: rect.right - rect.left }, (_, index) => {
      const pos = map.map[rect.top * map.width + rect.left + index]!
      const cell = table.nodeAt(pos)!
      const offset = rect.left + index - map.findCell(pos).left
      return (cell.attrs.colwidth as number[] | null)?.[offset] ?? 0
    })
    const at = tableStart + first!
    tr.replaceWith(
      at,
      at + target.nodeSize,
      target.type.create(
        {
          ...target.attrs,
          colspan: rect.right - rect.left,
          rowspan: rect.bottom - rect.top,
          colwidth: widths.some(Boolean) ? widths : null,
        },
        content,
      ),
    )
    tr.setSelection(TextSelection.create(tr.doc, at + 1))
    dispatch(tr)
  }
  return true
}

/** Whether the selection is in (or on) a merged cell. */
export function inMergedCell(state: EditorState) {
  if (!isInTable(state)) return false
  const $cell = selectionCell(state)
  const cell = $cell.nodeAfter
  return !!cell && (cell.attrs.colspan > 1 || cell.attrs.rowspan > 1)
}

/** Split a merged cell back into single cells; its text stays in the first. */
export const splitMergedCell: Command = (state, dispatch) => splitCell(state, dispatch)

/** Empty the selected cells. */
export const clearCells: Command = deleteCellSelection

/** Align the text of the selected columns. */
export function alignColumns(align: TableAlign | null): Command {
  return (state, dispatch) => {
    if (!isInTable(state)) return false
    if (dispatch) {
      const rect = selectedRect(state)
      const columns = columnsOf(rect).map((column, index) => {
        if (index < rect.left || index >= rect.right) return column
        return align && align !== 'left' ? { id: column.id, align } : { id: column.id }
      })
      dispatch(state.tr.setNodeAttribute(rect.tableStart - 1, 'columns', columns))
    }
    return true
  }
}

/** Turn the first row (or column) into a header, or back. */
export function toggleHeader(which: 'headerRow' | 'headerColumn'): Command {
  return (state, dispatch) => {
    const found = tableAt(state.selection.$from)
    if (!found) return false
    if (dispatch) dispatch(state.tr.setNodeAttribute(found.pos, which, !found.node.attrs[which]))
    return true
  }
}

/* moving the cursor */

const cellStart = (state: EditorState) => cellAround(state.selection.$head)

/**
 * `Tab` / `Shift+Tab`: the next or previous cell, its text selected.
 * `Tab` in the last cell adds a row.
 */
export function goToCell(direction: 1 | -1): Command {
  return (state, dispatch) => {
    const $cell = cellStart(state)
    const found = $cell && tableAt($cell)
    if (!$cell || !found) return false
    const { map, pos } = found
    const start = pos + 1
    const rect = map.findCell($cell.pos - start)
    const cells: number[] = []
    for (const cell of map.map) if (!cells.includes(cell)) cells.push(cell)
    const index = cells.indexOf(map.map[rect.top * map.width + rect.left]!)
    let next = cells[index + direction]
    let tr = state.tr
    if (next === undefined) {
      if (direction < 0) return false
      if (!dispatch) return true
      const full = selectedRect(state)
      tr = addRow(tr, { ...full, top: map.height - 1, bottom: map.height }, map.height)
      const table = tr.doc.nodeAt(pos)!
      const after = TableMap.get(table)
      next = after.map[map.height * after.width]!
    }
    if (dispatch) {
      const table = tr.doc.nodeAt(pos)!
      const cell = table.nodeAt(next)!
      const from = start + next + 1
      dispatch(
        tr
          .setSelection(TextSelection.create(tr.doc, from, from + cell.content.size))
          .scrollIntoView(),
      )
    }
    return true
  }
}

/** `Enter`: the cell below, adding a row at the bottom. */
export const goDown: Command = (state, dispatch) => {
  const $cell = cellStart(state)
  const found = $cell && tableAt($cell)
  if (!$cell || !found) return false
  const { map, pos } = found
  const start = pos + 1
  const rect = map.findCell($cell.pos - start)
  let tr = state.tr
  let below = rect.bottom
  if (below >= map.height) {
    if (!dispatch) return true
    tr = addRow(tr, { ...selectedRect(state), top: map.height - 1, bottom: map.height }, map.height)
    below = map.height
  }
  if (dispatch) {
    const table = tr.doc.nodeAt(pos)!
    const after = TableMap.get(table)
    const cell = after.map[below * after.width + rect.left]!
    const from = start + cell + 1 + table.nodeAt(cell)!.content.size
    dispatch(tr.setSelection(TextSelection.create(tr.doc, from)).scrollIntoView())
  }
  return true
}

/** `Backspace` at the start of a cell, `Delete` at its end: nothing, so cells never join. */
export function stopAtCellEdge(side: 'start' | 'end'): Command {
  return (state) => {
    const { $from, empty } = state.selection
    if (!empty || $from.parent.type.spec.tableRole === undefined) return false
    const role = $from.parent.type.spec.tableRole
    if (role !== 'cell' && role !== 'header_cell') return false
    return side === 'start'
      ? $from.parentOffset === 0
      : $from.parentOffset === $from.parent.content.size
  }
}
