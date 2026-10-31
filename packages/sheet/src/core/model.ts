import type { Tone } from 'dou-ui'

/** What a cell holds. A string starting with `=` is a formula. */
export type SheetValue = string | number | boolean | null

/** A cell with more than a value. */
export interface SheetCell {
  value?: SheetValue
  /** The name of a style in the workbook's `styles`. */
  style?: string
  /**
   * How a number or date shows, such as `0.00`, `#,##0`, `0%`, `¥#,##0.00`
   * or `yyyy-mm-dd`. The value itself is kept as it is.
   */
  format?: string
  /** A note on the cell. */
  note?: string
}

/** A cell as written in the data: a bare value, or a cell with a style or format. */
export type SheetCellInput = SheetValue | SheetCell | undefined

/** One row of cells, left to right. Empty cells can be left out (`undefined` or `null`). */
export type SheetRow = SheetCellInput[]

export interface SheetFreeze {
  /** Rows kept at the top while scrolling. */
  rows?: number
  /** Columns kept at the left while scrolling. */
  cols?: number
}

/** One sheet of a workbook. */
export interface SheetData {
  /**
   * A stable name for the sheet that changes and collaboration refer to.
   * Without one they use `name`; give an `id` when sheets can be renamed
   * while changes are on their way, e.g. from another client.
   */
  id?: string
  /** Shown on the sheet's tab and used by formulas to refer to it. Unique in the workbook. */
  name: string
  /** The cells, row by row. Rows and cells past the data can be left out. */
  cells: (SheetRow | null | undefined)[]
  /** How many rows the sheet has; at least the rows in `cells`. Defaults to 1000. */
  rowCount?: number
  /** How many columns the sheet has; at least the widest row. Defaults to 26. */
  colCount?: number
  /** Row heights that differ from the default, by row number; `0` hides the row. */
  rowSizes?: Record<number, number>
  /** Column widths that differ from the default, by column number; `0` hides the column. */
  colSizes?: Record<number, number>
  freeze?: SheetFreeze
  /**
   * Merged cells, as ranges such as `'A1:C1'`. The top left cell of each
   * holds what it shows; the cells it covers keep their data but are not
   * shown. Merges must not overlap.
   */
  merges?: string[]
}

/** How cells that use a style look. Tones follow the color mode; colors are used as given. */
export interface SheetStyle {
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strike?: boolean
  /** Text in a tone's color. */
  tone?: Tone
  /** A soft fill in a tone's color. */
  fill?: Tone
  /** Any CSS color for the text; wins over `tone`. */
  color?: string
  /** Any CSS color for the fill; wins over `fill`. */
  background?: string
  /** Defaults to the value's own: numbers right, true and false centered, text left. */
  align?: 'left' | 'center' | 'right'
  valign?: 'top' | 'middle' | 'bottom'
  /** Wrap long text onto more lines instead of cutting it off. */
  wrap?: boolean
}

export interface SheetWorkbook {
  sheets: SheetData[]
  /** Named styles, which cells refer to by name. */
  styles?: Record<string, SheetStyle>
}

export const DEFAULT_ROWS = 1000
export const DEFAULT_COLS = 26

/** The cell as an object, or `undefined` when it is empty. */
export function cellOf(input: SheetCellInput): SheetCell | undefined {
  if (input == null || input === '') return undefined
  return typeof input === 'object' ? input : { value: input }
}

/** The value of a cell as written in the data. */
export function valueOf(input: SheetCellInput): SheetValue {
  if (input == null) return null
  return typeof input === 'object' ? (input.value ?? null) : input
}

/** Whether a cell has no value (it may still have a style). */
export const isBlank = (input: SheetCellInput) => {
  const value = valueOf(input)
  return value == null || value === ''
}

/** The shortest way to write a cell: a bare value when that is all it has. */
export function compactCell(cell: SheetCell | undefined): SheetCellInput {
  if (!cell) return undefined
  let only: SheetValue | undefined
  let count = 0
  for (const key in cell) {
    const value = cell[key as keyof SheetCell]
    if (value === undefined) continue
    count++
    if (key === 'value') only = value as SheetValue
  }
  if (count === 0) return undefined
  if (count === 1 && only !== undefined) return only === '' ? undefined : only
  const out: SheetCell = {}
  for (const key in cell) {
    const value = cell[key as keyof SheetCell]
    if (value !== undefined) (out as Record<string, unknown>)[key] = value
  }
  return out
}

/** The cell at a row and column. */
export const cellAt = (sheet: SheetData, row: number, col: number): SheetCellInput =>
  sheet.cells[row]?.[col] ?? undefined

/** How many rows a sheet has, counting its data. */
export const rowCountOf = (sheet: SheetData) =>
  Math.max(sheet.rowCount ?? DEFAULT_ROWS, sheet.cells.length)

/** How many columns a sheet has, counting its widest row. */
export function colCountOf(sheet: SheetData) {
  let widest = 0
  for (const row of sheet.cells) if (row && row.length > widest) widest = row.length
  return Math.max(sheet.colCount ?? DEFAULT_COLS, widest)
}
