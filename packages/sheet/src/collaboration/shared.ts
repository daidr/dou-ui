import * as Y from 'yjs'
import {
  cellOf,
  colCountOf,
  compactCell,
  rowCountOf,
  type SheetCellInput,
  type SheetData,
  type SheetWorkbook,
} from '../core/model'
import {
  anchorCell,
  anchorRange,
  anchorText,
  resolveCell,
  resolveRange,
  resolveText,
  SheetLayout,
  SheetLines,
  type AnchoredText,
  type LayoutSheet,
} from './anchor'

/*
 * The shared document, under the map given as `book`:
 *
 *   styles  Y.Map    name → style
 *   types   Y.Map    name → cell type setup
 *   order   Y.Array  sheet ids, in the order of the tabs
 *   sheets  Y.Map    sheet id → Y.Map
 *     rows, cols          Y.Array  line ids, top to bottom and left to right
 *     cells               Y.Map    `${rowId}:${colId}` → cell, and
 *                                  `${rowId}:${colId}#` → the id of its comment thread
 *     rowSizes, colSizes  Y.Map    line id → px
 *     meta                Y.Map    the sheet's other fields: name, freeze, merges, rules…
 *
 * Lines are known by ids, so a cell, a size or a reference stays with its
 * line however many are inserted, deleted or moved before it at the same
 * time. Moving a line takes its id out and puts it back elsewhere; when
 * two people move the same line at once it is in the list twice, and the
 * first one counts.
 */

export type SharedMap = Y.Map<unknown>
export type SharedList = Y.Array<string>

/** The fields of a sheet that aren't kept in `meta`. */
const OWN_FIELDS = new Set(['id', 'cells', 'rowSizes', 'colSizes', 'rowCount', 'colCount'])
export const isMetaKey = (key: string) => !OWN_FIELDS.has(key)

/** The parts of the shared workbook; its other keys are the workbook's own settings, such as `protect`. */
const BOOK_PARTS = new Set(['styles', 'types', 'order', 'sheets'])
/** Whether a key of the workbook is one of its own settings, kept as it is in the shared map. */
export const isBookKey = (key: string) => !BOOK_PARTS.has(key)

/** The fields of a sheet whose ranges or formulas are anchored to its lines. */
export const ANCHORED_META = [
  'merges',
  'filter',
  'conditionalFormats',
  'validations',
  'groups',
] as const

export const cellKey = (row: string, col: string) => `${row}:${col}`

/*
 * A cell's comment thread is kept beside the cell, under its own key: undo
 * puts back a cell's value without taking the thread put on it since, and
 * putting one on doesn't overwrite what someone else typed at the same time.
 */
export const threadKey = (key: string) => `${key}#`
export const isThreadKey = (key: string) => key.endsWith('#')
/** The cell a key is about: the cell's own key for its thread's. */
export const cellOfKey = (key: string) => (isThreadKey(key) ? key.slice(0, -1) : key)

/** A cell with the thread kept beside it. */
export function withThread(cell: SheetCellInput, thread: unknown): SheetCellInput {
  if (typeof thread !== 'string' || !thread) return cell
  return compactCell({ ...cellOf(cell), comment: thread })
}

/** A cell without its thread, and the thread. */
export function splitThread(cell: SheetCellInput): [SheetCellInput, string | undefined] {
  if (!cell || typeof cell !== 'object' || !cell.comment) return [cell, undefined]
  return [compactCell({ ...cell, comment: undefined }), cell.comment]
}

/** Where a cell kept under `key` is now; `-1` for a line that is gone. */
export function cellAt(key: string, here: LayoutSheet) {
  const split = key.indexOf(':')
  return {
    row: here.rows.indexOf(key.slice(0, split)),
    col: here.cols.indexOf(key.slice(split + 1)),
  }
}

/** Sizes kept by line id, by line number. */
function sizesOf(map: SharedMap, lines: SheetLines) {
  const out: Record<number, number> = {}
  map.forEach((size, id) => {
    const at = lines.indexOf(id)
    if (at >= 0 && typeof size === 'number') out[at] = size
  })
  return Object.keys(out).length ? out : undefined
}

/** Ids for new lines and sheets, unique across the people editing one document. */
const counters = new WeakMap<object, { n: number }>()
export function makeIds(doc: Y.Doc | null) {
  const owner = doc ?? {}
  let counter = counters.get(owner)
  if (!counter) counters.set(owner, (counter = { n: 0 }))
  const prefix = `${(doc?.clientID ?? Math.floor(Math.random() * 2 ** 32)).toString(36)}.`
  const next = () => prefix + (counter.n++).toString(36)
  return {
    next,
    many: (count: number) => Array.from({ length: count }, next),
  }
}
export type IdMaker = ReturnType<typeof makeIds>

/** A list without repeats, the first of each kept. */
export function unique(list: readonly string[]) {
  const seen = new Set<string>()
  const out: string[] = []
  for (const id of list)
    if (!seen.has(id)) {
      seen.add(id)
      out.push(id)
    }
  return out
}

export interface SharedParts {
  styles: SharedMap
  types: SharedMap
  order: SharedList
  sheets: Y.Map<SharedMap>
}

/** The parts of the shared workbook, `null` before it is filled. */
export function partsOf(book: SharedMap): SharedParts | null {
  const styles = book.get('styles')
  const types = book.get('types')
  const order = book.get('order')
  const sheets = book.get('sheets')
  if (
    !(styles instanceof Y.Map) ||
    !(types instanceof Y.Map) ||
    !(order instanceof Y.Array) ||
    !(sheets instanceof Y.Map)
  )
    return null
  return { styles, types, order, sheets } as SharedParts
}

export interface SharedSheet {
  rows: SharedList
  cols: SharedList
  cells: SharedMap
  rowSizes: SharedMap
  colSizes: SharedMap
  meta: SharedMap
}

export function sheetParts(map: SharedMap | undefined): SharedSheet | null {
  if (!(map instanceof Y.Map)) return null
  const parts = {
    rows: map.get('rows'),
    cols: map.get('cols'),
    cells: map.get('cells'),
    rowSizes: map.get('rowSizes'),
    colSizes: map.get('colSizes'),
    meta: map.get('meta'),
  }
  if (!(parts.rows instanceof Y.Array) || !(parts.cols instanceof Y.Array)) return null
  for (const key of ['cells', 'rowSizes', 'colSizes', 'meta'] as const)
    if (!(parts[key] instanceof Y.Map)) return null
  return parts as SharedSheet
}

/** The sheets as the shared document has them: ids, names and lines. */
export function readLayout(parts: SharedParts): SheetLayout {
  const layout = new SheetLayout()
  for (const id of unique(parts.order.toArray())) {
    const sheet = sheetParts(parts.sheets.get(id))
    if (!sheet) continue
    const name = sheet.meta.get('name')
    layout.sheets.set(id, {
      id,
      name: typeof name === 'string' ? name : id,
      rows: new SheetLines(unique(sheet.rows.toArray())),
      cols: new SheetLines(unique(sheet.cols.toArray())),
    })
  }
  return layout
}

// Rules and other fields -----------------------------------------------------------------

type Json = Record<string, unknown>

const isAnchored = (value: unknown): value is AnchoredText =>
  typeof value === 'object' && value !== null && !Array.isArray(value) && 't' in value

/** A field of a sheet as the shared document keeps it. */
export function anchorMeta(key: string, value: unknown, here: LayoutSheet, layout: SheetLayout) {
  if (value == null) return value
  const range = (text: string) => anchorRange(text, here, layout)
  const colKey = (col: number) => here.cols.ids[col] ?? `#${col}`
  switch (key) {
    case 'merges':
      return (value as string[]).map(range)
    case 'filter': {
      const filter = value as Json & { range: string; columns?: Json; sorted?: Json }
      const out: Json = { ...filter, range: range(filter.range) }
      if (filter.columns)
        out.columns = Object.fromEntries(
          Object.entries(filter.columns).map(([col, rule]) => [colKey(Number(col)), rule]),
        )
      if (filter.sorted) out.sorted = { ...filter.sorted, col: colKey(filter.sorted.col as number) }
      return out
    }
    case 'groups':
      return (value as Json[]).map((group) => ({ ...group, range: range(group.range as string) }))
    case 'conditionalFormats':
    case 'validations':
      return (value as Json[]).map((rule) => {
        const out: Json = { ...rule }
        const ranges = rule.range as string | string[]
        out.range = Array.isArray(ranges) ? ranges.map(range) : range(ranges)
        if (typeof rule.formula === 'string') out.formula = anchorText(rule.formula, here, layout)
        if (typeof rule.list === 'string') out.list = anchorText(rule.list, here, layout)
        return out
      })
    default:
      return value
  }
}

/** A field of a sheet read from the shared document; `undefined` when its cells are gone. */
export function resolveMeta(key: string, stored: unknown, here: LayoutSheet, layout: SheetLayout) {
  if (stored == null) return undefined
  const range = (value: unknown) => (isAnchored(value) ? resolveRange(value, here, layout) : null)
  const colOf = (col: string) => (col[0] === '#' ? Number(col.slice(1)) : here.cols.indexOf(col))
  switch (key) {
    case 'merges': {
      const merges = (stored as unknown[]).map(range).filter((text) => text !== null)
      return merges.length ? merges : undefined
    }
    case 'filter': {
      const filter = stored as Json & { columns?: Json; sorted?: Json }
      const text = range(filter.range)
      if (text === null) return undefined
      const out: Json = { ...filter, range: text }
      if (filter.columns) {
        const columns: Json = {}
        for (const [col, rule] of Object.entries(filter.columns)) {
          const at = colOf(col)
          if (at >= 0) columns[at] = rule
        }
        if (Object.keys(columns).length) out.columns = columns
        else delete out.columns
      }
      if (filter.sorted) {
        const at = colOf(String(filter.sorted.col))
        if (at >= 0) out.sorted = { ...filter.sorted, col: at }
        else delete out.sorted
      }
      return out
    }
    case 'groups': {
      // a group goes when its lines do
      const groups: Json[] = []
      for (const group of stored as Json[]) {
        const text = range(group.range)
        if (text !== null) groups.push({ ...group, range: text })
      }
      return groups.length ? groups : undefined
    }
    case 'conditionalFormats':
    case 'validations': {
      const rules: Json[] = []
      for (const rule of stored as Json[]) {
        const many = Array.isArray(rule.range)
        const texts = (many ? (rule.range as unknown[]) : [rule.range])
          .map(range)
          .filter((text) => text !== null)
        // a rule goes when all its cells do
        if (!texts.length) continue
        const out: Json = { ...rule, range: many ? texts : texts[0] }
        if (isAnchored(rule.formula)) out.formula = resolveText(rule.formula, here, layout)
        if (isAnchored(rule.list)) out.list = resolveText(rule.list, here, layout)
        rules.push(out)
      }
      return rules.length ? rules : undefined
    }
    default:
      return stored
  }
}

// Whole sheets and workbooks -------------------------------------------------------------

const isEmpty = (cell: unknown) => cell == null || cell === ''

/** Writes a whole sheet into `sheets` under its id, with the lines `here` gives it. */
export function writeSheet(
  sheets: Y.Map<SharedMap>,
  data: SheetData,
  here: LayoutSheet,
  layout: SheetLayout,
) {
  const map = new Y.Map<unknown>()
  sheets.set(here.id, map)
  const rows = new Y.Array<string>()
  const cols = new Y.Array<string>()
  const cells = new Y.Map<unknown>()
  const rowSizes = new Y.Map<unknown>()
  const colSizes = new Y.Map<unknown>()
  const meta = new Y.Map<unknown>()
  map.set('rows', rows)
  map.set('cols', cols)
  map.set('cells', cells)
  map.set('rowSizes', rowSizes)
  map.set('colSizes', colSizes)
  map.set('meta', meta)
  rows.push(here.rows.ids)
  cols.push(here.cols.ids)
  data.cells.forEach((line, r) =>
    line?.forEach((input, c) => {
      const [cell, thread] = splitThread(input)
      const key = cellKey(here.rows.ids[r]!, here.cols.ids[c]!)
      const stored = anchorCell(cell, here, layout)
      if (!isEmpty(stored)) cells.set(key, stored)
      if (thread) cells.set(threadKey(key), thread)
    }),
  )
  for (const [index, size] of Object.entries(data.rowSizes ?? {}))
    rowSizes.set(here.rows.ids[Number(index)]!, size)
  for (const [index, size] of Object.entries(data.colSizes ?? {}))
    colSizes.set(here.cols.ids[Number(index)]!, size)
  for (const [key, value] of Object.entries(data))
    if (isMetaKey(key) && value !== undefined) meta.set(key, anchorMeta(key, value, here, layout))
}

/** A sheet's place in the layout, with new ids for its lines. */
export function layoutSheet(data: SheetData, id: string, ids: IdMaker): LayoutSheet {
  return {
    id,
    name: data.name,
    rows: new SheetLines(ids.many(rowCountOf(data))),
    cols: new SheetLines(ids.many(colCountOf(data))),
  }
}

/**
 * Writes a workbook into an empty shared map, e.g. when a workbook so far
 * saved as JSON starts being edited together. Sheets without an `id` get one.
 */
export function fillBook(book: SharedMap, workbook: SheetWorkbook) {
  const fill = () => {
    const ids = makeIds(book.doc)
    const styles = new Y.Map<unknown>()
    const types = new Y.Map<unknown>()
    const order = new Y.Array<string>()
    const sheets = new Y.Map<SharedMap>()
    book.set('styles', styles)
    book.set('types', types)
    book.set('order', order)
    book.set('sheets', sheets)
    for (const [name, style] of Object.entries(workbook.styles ?? {})) styles.set(name, style)
    for (const [name, setup] of Object.entries(workbook.types ?? {})) types.set(name, setup)
    for (const [key, value] of Object.entries(workbook))
      if (isBookKey(key) && value !== undefined) book.set(key, value)
    const layout = new SheetLayout()
    const placed = workbook.sheets.map((data) => {
      let id = data.id
      while (id == null || layout.sheets.has(id)) id = ids.next()
      const here = layoutSheet(data, id, ids)
      layout.sheets.set(id, here)
      return { data, here }
    })
    // every sheet has its lines before any formula is anchored, as formulas reach across
    for (const { data, here } of placed) writeSheet(sheets, data, here, layout)
    order.push(placed.map(({ here }) => here.id))
  }
  if (book.doc) book.doc.transact(fill)
  else fill()
}

/** A sheet as the shared document has it. */
export function readSheet(parts: SharedSheet, here: LayoutSheet, layout: SheetLayout): SheetData {
  const cells: SheetData['cells'] = []
  parts.cells.forEach((stored, key) => {
    // a thread on an empty cell has no cell of its own
    if (isThreadKey(key)) {
      key = cellOfKey(key)
      if (parts.cells.has(key)) return
      stored = undefined
    }
    const { row, col } = cellAt(key, here)
    // the cells of lines someone deleted while someone else wrote them
    if (row < 0 || col < 0) return
    const cell = withThread(resolveCell(stored, here, layout), parts.cells.get(threadKey(key)))
    if (isEmpty(cell)) return
    while (cells.length < row) cells.push(null)
    const line = (cells[row] ??= [])
    while (line.length < col) line.push(undefined)
    line[col] = cell
  })
  const data: SheetData = {
    id: here.id,
    name: here.name,
    cells,
    rowCount: here.rows.ids.length,
    colCount: here.cols.ids.length,
  }
  const rowSizes = sizesOf(parts.rowSizes, here.rows)
  const colSizes = sizesOf(parts.colSizes, here.cols)
  if (rowSizes) data.rowSizes = rowSizes
  if (colSizes) data.colSizes = colSizes
  parts.meta.forEach((stored, key) => {
    if (key === 'name' || !isMetaKey(key)) return
    const value = resolveMeta(key, stored, here, layout)
    if (value !== undefined) (data as unknown as Json)[key] = value
  })
  return data
}

/** The workbook a shared map holds; an empty workbook before it is filled. */
export function readBook(book: SharedMap): SheetWorkbook {
  const parts = partsOf(book)
  if (!parts) return { sheets: [] }
  const layout = readLayout(parts)
  const workbook: SheetWorkbook = { sheets: [] }
  if (parts.styles.size) workbook.styles = parts.styles.toJSON() as SheetWorkbook['styles']
  if (parts.types.size) workbook.types = parts.types.toJSON() as SheetWorkbook['types']
  book.forEach((value, key) => {
    if (isBookKey(key)) (workbook as unknown as Json)[key] = value
  })
  for (const here of layout.sheets.values())
    workbook.sheets.push(readSheet(sheetParts(parts.sheets.get(here.id))!, here, layout))
  return workbook
}

// Lists of ids ---------------------------------------------------------------------------

/** The indexes of the longest strictly increasing run of `values`. */
export function increasingRun(values: readonly number[]): Set<number> {
  const tails: number[] = []
  const previous: number[] = []
  values.forEach((value, index) => {
    let low = 0
    let high = tails.length
    while (low < high) {
      const mid = (low + high) >> 1
      if (values[tails[mid]!]! < value) low = mid + 1
      else high = mid
    }
    previous[index] = low > 0 ? tails[low - 1]! : -1
    tails[low] = index
  })
  const run = new Set<number>()
  let index = tails.length ? tails[tails.length - 1]! : -1
  while (index >= 0) {
    run.add(index)
    index = previous[index]!
  }
  return run
}

/**
 * Brings a shared list of ids to `wanted` with as few changes as it takes:
 * the longest run already in order stays, the rest is taken out and put
 * back where it goes, so others' changes to the list around it still merge.
 */
export function syncList(list: SharedList, wanted: readonly string[]) {
  const current = list.toArray()
  if (current.length === wanted.length && current.every((id, i) => id === wanted[i])) return
  const rank = new Map(wanted.map((id, i) => [id, i]))
  // the first of each wanted id, in the list's order
  const seen = new Set<string>()
  const firsts: number[] = []
  current.forEach((id, i) => {
    if (seen.has(id) || !rank.has(id)) return
    seen.add(id)
    firsts.push(i)
  })
  const run = increasingRun(firsts.map((i) => rank.get(current[i]!)!))
  const stays = new Set<number>()
  const kept = new Set<string>()
  firsts.forEach((at, k) => {
    if (!run.has(k)) return
    stays.add(at)
    kept.add(current[at]!)
  })
  for (let i = current.length - 1; i >= 0;) {
    if (stays.has(i)) {
      i--
      continue
    }
    let start = i
    while (start > 0 && !stays.has(start - 1)) start--
    list.delete(start, i - start + 1)
    i = start - 1
  }
  let at = 0
  for (let k = 0; k < wanted.length;) {
    if (kept.has(wanted[k]!)) {
      at++
      k++
      continue
    }
    let end = k
    while (end < wanted.length && !kept.has(wanted[end]!)) end++
    list.insert(at, wanted.slice(k, end))
    at += end - k
    k = end
  }
}
