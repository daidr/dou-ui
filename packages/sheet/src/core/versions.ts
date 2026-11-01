import { formatCell } from './address'
import {
  cellOf,
  colCountOf,
  compactCell,
  rowCountOf,
  type SheetCellInput,
  type SheetData,
  type SheetWorkbook,
} from './model'
import {
  sheetKey,
  type SheetBookPatch,
  type SheetPatch,
  type SheetTransaction,
} from './transaction'

/*
 * Versions of a workbook: what changed between two, and going back to one.
 * Sheets are matched by `id` (or name); cells by where they are, as rows
 * and columns have no ids of their own. A cell's comment thread is not
 * part of a version: it doesn't count as a change, and going back to a
 * version keeps the threads where they are.
 */

/** A cell that differs between two versions. */
export interface SheetCellChange {
  /** The sheet's key: its `id`, or its name. */
  sheet: string
  row: number
  col: number
  /** The cell as people write it, e.g. `B3`. */
  address: string
  before: SheetCellInput
  after: SheetCellInput
}

export interface WorkbookDiff {
  /** The cells that differ on the sheets in both versions, sheet by sheet, row by row. */
  cells: SheetCellChange[]
  /** The keys of the sheets only the newer version has. */
  addedSheets: string[]
  /** The keys of the sheets only the older version has. */
  removedSheets: string[]
  /** The keys of the sheets whose other settings (name, sizes, merges, rules, protection…) differ. */
  changedSheets: string[]
  /** The named styles (in `styles`) that differ, such as one now unlocking its cells. */
  changedStyles: string[]
  /** The named cell types (in `types`) that differ. */
  changedTypes: string[]
  /** Whether the workbook's own settings, such as `protect`, differ. */
  bookChanged: boolean
}

/**
 * A cell as versions compare it: without its thread, fields left
 * `undefined` dropped, and an empty value (`''` or `null`) taken for none,
 * so `{ value: 1 }` and `1` are the same cell.
 */
const bare = (cell: SheetCellInput): SheetCellInput => {
  const own = cellOf(cell)
  if (!own) return undefined
  const { comment: _comment, ...rest } = own
  if (rest.value === '' || rest.value === null) rest.value = undefined
  return compactCell(rest) ?? undefined
}

/** JSON with the keys of objects in order, so the order they were written in doesn't count. */
const stable = (value: unknown): string =>
  JSON.stringify(value ?? null, (_key, item: unknown) =>
    item && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(
          Object.entries(item as Record<string, unknown>)
            .filter(([, v]) => v !== undefined)
            // oxlint-disable-next-line unicorn/no-array-sort -- sorts a fresh array
            .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
        )
      : item,
  )

const same = (a: unknown, b: unknown) => a === b || stable(a) === stable(b)

const sameCell = (a: SheetCellInput, b: SheetCellInput) => same(bare(a), bare(b))

/** The fields of a sheet other than its cells and sizes. */
function settingsOf(sheet: SheetData) {
  const { cells: _cells, rowSizes: _rows, colSizes: _cols, id: _id, ...rest } = sheet
  return { ...rest, rowCount: rowCountOf(sheet), colCount: colCountOf(sheet) }
}

/** The cells that differ between two sheets, as `[row, col]`. */
function changedCells(before: SheetData, after: SheetData) {
  const out: [number, number][] = []
  const rows = Math.max(before.cells.length, after.cells.length)
  for (let row = 0; row < rows; row++) {
    const a = before.cells[row]
    const b = after.cells[row]
    if (a === b) continue
    const cols = Math.max(a?.length ?? 0, b?.length ?? 0)
    for (let col = 0; col < cols; col++) if (!sameCell(a?.[col], b?.[col])) out.push([row, col])
  }
  return out
}

/** The workbook's own settings, such as `protect`. */
function bookSettings(book: SheetWorkbook) {
  const { sheets: _sheets, styles: _styles, types: _types, ...rest } = book
  return rest
}

/** The names whose entries differ between two records of named things. */
function changedNames(a: Record<string, unknown> = {}, b: Record<string, unknown> = {}) {
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].filter(
    (name) => !same(a[name], b[name]),
  )
}

/** What changed from `before` to `after`. */
export function diffWorkbooks(before: SheetWorkbook, after: SheetWorkbook): WorkbookDiff {
  const old = new Map(before.sheets.map((sheet) => [sheetKey(sheet), sheet]))
  const now = new Set(after.sheets.map(sheetKey))
  const diff: WorkbookDiff = {
    cells: [],
    addedSheets: [],
    removedSheets: [],
    changedSheets: [],
    changedStyles: [],
    changedTypes: [],
    bookChanged: !same(bookSettings(before), bookSettings(after)),
  }
  for (const sheet of after.sheets) {
    const key = sheetKey(sheet)
    const was = old.get(key)
    if (!was) {
      diff.addedSheets.push(key)
      continue
    }
    for (const [row, col] of changedCells(was, sheet))
      diff.cells.push({
        sheet: key,
        row,
        col,
        address: formatCell({ row, col }),
        before: was.cells[row]?.[col] ?? undefined,
        after: sheet.cells[row]?.[col] ?? undefined,
      })
    if (
      !same(settingsOf(was), settingsOf(sheet)) ||
      !same(was.rowSizes, sheet.rowSizes) ||
      !same(was.colSizes, sheet.colSizes)
    )
      diff.changedSheets.push(key)
  }
  for (const key of old.keys()) if (!now.has(key)) diff.removedSheets.push(key)
  diff.changedStyles = changedNames(before.styles, after.styles)
  diff.changedTypes = changedNames(before.types, after.types)
  return diff
}

/** A version's sheet without the threads it had then. */
function withoutThreads(sheet: SheetData): SheetData {
  return {
    ...sheet,
    cells: sheet.cells.map((line) => line?.map((cell) => bare(cell)) ?? line),
  }
}

/**
 * Adds the steps that bring the workbook to `book`, writing only what
 * differs: cells, sizes and settings of the sheets in both (protection
 * too), sheets added and removed, their order, the workbook's settings,
 * and the named styles and types.
 */
export function restoreWorkbook(tr: SheetTransaction, book: SheetWorkbook) {
  const wanted = book.sheets.map(sheetKey)
  // sheets the version has and the workbook doesn't, where they go
  book.sheets.forEach((sheet, index) => {
    if (tr.indexOf(sheetKey(sheet)) === -1)
      tr.step({
        type: 'insertSheet',
        index: Math.min(index, tr.doc.sheets.length),
        data: withoutThreads(sheet),
      })
  })
  for (const sheet of tr.doc.sheets.slice())
    if (!wanted.includes(sheetKey(sheet))) tr.step({ type: 'removeSheet', sheet: sheetKey(sheet) })
  wanted.forEach((key, index) => {
    if (tr.indexOf(key) !== index) tr.step({ type: 'moveSheet', sheet: key, index })
  })

  for (const sheet of book.sheets) {
    const key = sheetKey(sheet)
    const now = tr.getSheet(key)
    // settings first: the size, so cells past the old one have room
    const was = settingsOf(now) as Record<string, unknown>
    const next = settingsOf(sheet) as Record<string, unknown>
    const patch: Record<string, unknown> = {}
    for (const name of new Set([...Object.keys(was), ...Object.keys(next)]))
      if (!same(was[name], next[name])) patch[name] = next[name]
    if (Object.keys(patch).length) tr.updateSheet(patch as SheetPatch, key)
    for (const axis of ['row', 'col'] as const) {
      const field = axis === 'row' ? 'rowSizes' : 'colSizes'
      const a = now[field] ?? {}
      const b = sheet[field] ?? {}
      for (const index of new Set([...Object.keys(a), ...Object.keys(b)]))
        if (a[Number(index)] !== b[Number(index)])
          tr.setSize(axis, Number(index), b[Number(index)], key)
    }
    for (const [row, col] of changedCells(tr.getSheet(key), sheet)) {
      const at = { sheet: key, row, col }
      // the thread on the cell stays
      const thread = cellOf(tr.getCell(at))?.comment
      tr.setCell(at, compactCell({ ...cellOf(bare(sheet.cells[row]?.[col])), comment: thread }))
    }
  }

  const was = bookSettings(tr.doc) as Record<string, unknown>
  const next = bookSettings(book) as Record<string, unknown>
  const patch: Record<string, unknown> = {}
  for (const name of changedNames(was, next)) patch[name] = next[name]
  if (Object.keys(patch).length) tr.updateBook(patch as SheetBookPatch)
  for (const name of changedNames(tr.doc.styles, book.styles))
    tr.setStyle(name, book.styles?.[name])
  for (const name of changedNames(tr.doc.types, book.types)) tr.setType(name, book.types?.[name])
  return tr
}
