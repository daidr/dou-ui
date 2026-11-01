import type { Tone } from 'dou-ui'

/**
 * What a cell holds. A string starting with `=` is a formula; text that
 * starts with `=` is written `'=…` and shows without the `'`.
 */
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
  /**
   * Where the cell links to: a web address (`https:`, `http:`, `mailto:`
   * or `tel:`), or a place in the workbook written `#` and a reference,
   * such as `#A20` or `#'汇总'!B2`. Other addresses are not followed.
   */
  link?: string
  /**
   * What kind of cell it is: `date`, `select`, `checkbox`, a type an
   * extension adds, or a name in the workbook's `types`. It decides how the
   * value shows and how it is edited.
   */
  type?: string
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
  /** A filter on a range: rows whose cells don't match its rules are hidden. */
  filter?: SheetFilter
  /**
   * Rows or columns that fold away together, such as the detail rows under
   * a subtotal. Groups on the same axis nest or stay apart, at most eight
   * deep.
   */
  groups?: SheetGroup[]
  /**
   * Where a group's heading or subtotal is, and so its button: on the row
   * above it (the column left of it) with `'before'`, the default, or below
   * it (right of it) with `'after'`.
   */
  groupSummary?: 'before' | 'after'
  /**
   * Looks cells take on when they meet a rule, such as a red fill for
   * amounts over budget. Where two formats give the same part of the look,
   * the earlier one wins.
   */
  conditionalFormats?: SheetConditionalFormat[]
  /**
   * What cells may hold, such as one of a list or a number from 1 to 5.
   * Where two rules cover a cell, the earlier one applies.
   */
  validations?: SheetValidation[]
  /**
   * Keeps the locked cells from being changed: every cell but those whose
   * style says `locked: false`, such as the blanks of a form to fill in.
   * Rows, columns and the sheet's rules can't be changed either, except
   * what the options allow. Code changes it with `tr.protectSheet`.
   */
  protect?: boolean | SheetProtection
}

/**
 * What people may still do on a protected sheet besides changing unlocked
 * cells. Everything is `false` by default.
 */
export interface SheetProtection {
  /** Change the look and number format of locked cells, and merge cells. */
  formatCells?: boolean
  /** Change column widths and hide columns. */
  formatColumns?: boolean
  /** Change row heights and hide rows. */
  formatRows?: boolean
  insertRows?: boolean
  insertColumns?: boolean
  deleteRows?: boolean
  deleteColumns?: boolean
  /** Use the sheet's filter to pick which rows show. Sorting moves cells, so only unlocked ones. */
  filter?: boolean
}

/** Rows or columns that fold away together. */
export interface SheetGroup {
  /** Whole rows such as `'3:8'`, or whole columns such as `'B:D'`. */
  range: string
  /** Folded: its rows or columns are hidden until it is expanded. */
  collapsed?: boolean
}

/**
 * A look for the cells of `range` that meet a rule. The rule is one of
 * `when`, `formula`, `top`, `bottom`, `average`, `duplicates` or `unique`, with
 * `style` as the look; or the cells are shaded by their numbers, with
 * `scale` or `bar`.
 */
export type SheetConditionalFormat =
  | SheetConditionalWhen
  | SheetConditionalFormula
  | SheetConditionalRank
  | SheetConditionalAverage
  | SheetConditionalDuplicates
  | SheetConditionalUnique
  | SheetConditionalScale
  | SheetConditionalBar

interface SheetConditionalBase {
  /**
   * The cells, such as `'D2:D40'`, or several ranges taken as one, such as
   * `['D2:D40', 'G2:G40']`.
   */
  range: SheetRuleRange
}

/**
 * The cells of a rule: a range, or several ranges taken as one. A rule's
 * formula is written for the top left cell of the first.
 */
export type SheetRuleRange = string | string[]

/** A look: a style's name in the workbook's `styles`, or a style. */
export type SheetConditionalStyle = string | SheetStyle

/** Cells whose value meets a condition, e.g. `{ op: 'gt', value: 100 }`. */
export interface SheetConditionalWhen extends SheetConditionalBase {
  when: SheetCondition
  style: SheetConditionalStyle
}

/**
 * Cells for which a formula comes to `TRUE` (or a number other than 0).
 * It is written for the range's top left cell and moves with each cell, as
 * a copied formula does: `'=$E2>$D2'` on `'A2:F40'` checks each row's E and D.
 */
export interface SheetConditionalFormula extends SheetConditionalBase {
  formula: string
  style: SheetConditionalStyle
}

/** The largest (`top`) or smallest (`bottom`) numbers of the range: a count, or a percent of them. */
export type SheetConditionalRank = SheetConditionalBase & {
  /** With `percent`, a percent of the numbers, e.g. `10` for the top 10%. */
  percent?: boolean
  style: SheetConditionalStyle
} & ({ top: number; bottom?: never } | { bottom: number; top?: never })

/** Numbers above or below the range's average. */
export interface SheetConditionalAverage extends SheetConditionalBase {
  average: 'above' | 'below'
  style: SheetConditionalStyle
}

/** Values that show up more than once in the range, compared as they show, without case. */
export interface SheetConditionalDuplicates extends SheetConditionalBase {
  duplicates: true
  style: SheetConditionalStyle
}

/** Values that show up only once in the range, compared as they show, without case. */
export interface SheetConditionalUnique extends SheetConditionalBase {
  unique: true
  style: SheetConditionalStyle
}

/** A tone, or any CSS color. */
export type SheetColor = Tone | (string & {})

/**
 * Fills each number's cell with a color between two or three, from the
 * smallest number to the largest (through the middle one with three), e.g.
 * `['danger', 'warning', 'success']`.
 */
export interface SheetConditionalScale extends SheetConditionalBase {
  scale: [SheetColor, SheetColor] | [SheetColor, SheetColor, SheetColor]
}

/**
 * Draws a bar in each number's cell, as long as the number is large
 * against the others. Negative numbers draw to the left of zero, in the
 * same color. `true` uses the neutral tone.
 */
export interface SheetConditionalBar extends SheetConditionalBase {
  bar: true | SheetColor
}

/**
 * What the cells of `range` may hold: one of a `list`, a value that meets
 * a condition (`when`), or one for which a `formula` comes to `TRUE`.
 * Empty cells always fit.
 */
export type SheetValidation = SheetValidationList | SheetValidationWhen | SheetValidationFormula

interface SheetValidationBase {
  /** The cells, such as `'D2:D40'`, or several ranges, such as `['E2:E9', 'G2:J9']`. */
  range: SheetRuleRange
  /**
   * Whether a typed value that doesn't fit is refused, `true` by default.
   * With `false` it is kept and marked. Pasted and filled values are always
   * kept and marked.
   */
  strict?: boolean
  /** Said when a value doesn't fit; by default the rule in words. */
  message?: string
  /** Shown beside the cell while it is the active one, e.g. what to enter. */
  prompt?: string
}

/**
 * One of a list: the values, or a reference to cells holding them, such as
 * `'=$H$2:$H$9'` or `'=城市!A2:A20'`. The cells get a list to pick from.
 */
export interface SheetValidationList extends SheetValidationBase {
  list: SheetSelectOption[] | string
}

/**
 * A value that meets a condition, e.g. `{ op: 'between', value: 1, to: 5 }`.
 * A number in the condition asks for a number; with `integer`, a whole one.
 */
export interface SheetValidationWhen extends SheetValidationBase {
  when: SheetCondition
  integer?: boolean
}

/**
 * A value for which a formula comes to `TRUE` (or a number other than 0).
 * It is written for the range's top left cell and moves with each cell:
 * `'=COUNTIF($A$2:$A$40, A2) = 1'` on `'A2:A40'` asks for values not repeated.
 */
export interface SheetValidationFormula extends SheetValidationBase {
  formula: string
}

/**
 * A filter on a range of rows. The range's first row holds the headings,
 * which get the filter buttons; the rows below are filtered. Rows hidden by
 * a filter are not stored as hidden: clearing the rules shows them again.
 */
export interface SheetFilter {
  /** The range, headings included, such as `'A1:E40'`. */
  range: string
  /** The rule of each filtered column, by column number. */
  columns?: Record<number, SheetFilterRule>
  /** The column the rows were last sorted by from the filter, shown on its button. */
  sorted?: { col: number; order: SheetSortOrder }
}

/**
 * Which rows a column keeps: those whose shown text is one of `values` (an
 * empty cell is `''`), or those that meet `condition`.
 */
export type SheetFilterRule = { values: string[] } | { condition: SheetCondition }

/**
 * A condition on a cell; numbers compare as numbers, text without case.
 * `between` and `notBetween` take `value` and `to`, both ends included.
 */
export interface SheetCondition {
  op:
    | 'eq'
    | 'ne'
    | 'gt'
    | 'ge'
    | 'lt'
    | 'le'
    | 'between'
    | 'notBetween'
    | 'contains'
    | 'notContains'
    | 'begins'
    | 'ends'
    | 'blank'
    | 'notBlank'
  value?: SheetValue
  /** The other end for `between` and `notBetween`. */
  to?: SheetValue
}

export type SheetSortOrder = 'asc' | 'desc'

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
  /**
   * With `false`, the cell can still be changed while its sheet is
   * protected. Cells are locked by default.
   */
  locked?: boolean
}

/**
 * A cell type with its settings, which cells refer to by name, e.g.
 * `{ type: 'select', options: ['未开始', '进行中', '已完成'] }`.
 */
export interface SheetTypeSetup {
  /** The cell type it sets up: `select`, or a type an extension adds. */
  type: string
  /** For `select`: the values to pick from, each a value or a value with a tone. */
  options?: SheetSelectOption[]
  /** Settings of types from extensions. */
  [key: string]: unknown
}

/** A value of a `select` cell; with a `tone` it shows as a soft tag in that tone. */
export type SheetSelectOption = SheetValue | { value: SheetValue; tone?: Tone }

export interface SheetWorkbook {
  sheets: SheetData[]
  /** Named styles, which cells refer to by name. */
  styles?: Record<string, SheetStyle>
  /** Named cell types with their settings, which cells refer to with `type`. */
  types?: Record<string, SheetTypeSetup>
  /**
   * Keeps the sheets as they are: none can be added, removed, moved or
   * renamed. Code changes it with `tr.updateBook({ protect })`.
   */
  protect?: boolean
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
