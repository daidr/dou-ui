import {
  boundsOf,
  columnIndex,
  formatRange,
  moveReferences,
  parseCell,
  shiftFormula,
  parseRange,
  dropReferences,
  renameReferences,
  splitSheet,
  type SheetBounds,
  type SheetRefMap,
  type SheetPoint,
  type SheetRange,
} from './address'
import {
  cellOf,
  colCountOf,
  compactCell,
  rowCountOf,
  type SheetCell,
  type SheetCellInput,
  type SheetConditionalFormat,
  type SheetData,
  type SheetFilter,
  type SheetFilterRule,
  type SheetGroup,
  type SheetRow,
  type SheetRuleRange,
  type SheetStyle,
  type SheetTypeSetup,
  type SheetValidation,
  type SheetValue,
  type SheetWorkbook,
  valueOf,
} from './model'
import { continueValues, type SheetFillMode } from './fill'
import { mergesOf, overlaps } from './merge'
import { groupRange, groupsOf, groupSpan } from './group'
import { rangesOf } from './conditional'
import { sortRows, textCollator, type SheetSortKey } from './data'

/** The lists of rules a sheet keeps, each rule with a `range`. */
/** Throws when a rule's ranges aren't all ranges. */
function checkRuleRange(range: SheetRuleRange) {
  const texts = rangesOf(range)
  if (!texts.length) throw new RangeError('A rule needs a range')
  for (const text of texts) if (!parseRange(text)) throw new RangeError(`"${text}" isn't a range`)
}

type RuleKey = 'conditionalFormats' | 'validations'
type RuleOf<K extends RuleKey> = K extends 'conditionalFormats'
  ? SheetConditionalFormat
  : SheetValidation

/*
 * Every change to a workbook is a list of steps. Applying a step also gives
 * the step that undoes it, so history, collaboration and the `transaction`
 * event all work on the same small vocabulary.
 *
 * Changes copy only what they touch: the workbook, the sheet, its list of
 * rows and the rows that change. Every other row stays the same array, so
 * the grid knows which rows to draw again by comparing them.
 */

type Patch<T> = { [K in keyof T]?: T[K] | undefined }

/** The parts of a sheet set with `updateSheet`. */
export type SheetPatch = Patch<Omit<SheetData, 'cells' | 'rowSizes' | 'colSizes'>>

/** Changes to a style: fields to set, and fields set to `undefined` to take off. */
export type SheetStylePatch = Patch<SheetStyle>

/** A style written the same way whatever order its fields came in. */
// oxlint-disable-next-line unicorn/no-array-sort -- sorts a fresh array
const styleKey = (style: SheetStyle) => JSON.stringify(style, Object.keys(style).sort())

/** A sheet: its index in the workbook, or its `id` or `name`. */
export type SheetRef = number | string

/**
 * A cell: `'B3'`, `'表 2'!B3` for another sheet, or a point with an
 * optional `sheet`. Without a sheet it is on the transaction's sheet.
 */
export type SheetCellAt = string | (SheetPoint & { sheet?: SheetRef })

/**
 * A range, written like a cell: `'A1:C4'`, `'表 2'!B:B`, or a range or its
 * bounds with an optional `sheet`.
 */
export type SheetRangeAt = string | ((SheetRange | SheetBounds) & { sheet?: SheetRef })

/** Rows or columns. */
export type SheetAxisName = 'row' | 'col'

/**
 * Rows or columns: a zero-based number, or as people write them, `'5'` or
 * `'5:7'` for rows and `'C'` or `'B:C'` for columns.
 */
export type SheetLinesAt = number | string | { from: number; count: number }

/** What made a change, as the `change` and `transaction` events tell it. */
export type SheetAction =
  | 'input'
  | 'paste'
  | 'cut'
  | 'fill'
  | 'clear'
  | 'resize'
  | 'move'
  | 'insert'
  | 'delete'
  | 'hide'
  | 'merge'
  | 'group'
  | 'note'
  | 'sort'
  | 'filter'
  | 'format'
  | 'validation'
  | 'style'
  | 'freeze'
  | 'sheet'
  | 'undo'
  | 'redo'
  | 'api'

/** What a step calls a sheet: its `id`, or its name when it has none. */
export const sheetKey = (sheet: SheetData) => sheet.id ?? sheet.name

/*
 * Steps name sheets by key rather than index, so they still apply after
 * sheets are reordered, and on another client in collaboration.
 */
export type SheetStep =
  /** Writes a cell; `cell` left out empties it. */
  | { type: 'setCell'; sheet: string; row: number; col: number; cell?: SheetCellInput }
  /** Sets a row's height or a column's width; `size` left out goes back to the default. */
  | { type: 'setSize'; sheet: string; axis: 'row' | 'col'; index: number; size?: number }
  | { type: 'updateSheet'; sheet: string; patch: SheetPatch }
  /** Adds, replaces or (with `style` left out) removes a named style. */
  | { type: 'setStyle'; name: string; style?: SheetStyle }
  /** Adds, replaces or (with `setup` left out) removes a named cell type. */
  | { type: 'setType'; name: string; setup?: SheetTypeSetup }
  /**
   * Adds `count` rows (or columns) before `index`, moving the rest down (or
   * right). They are empty unless `cells` and `sizes` fill them: for rows,
   * `cells` holds the rows; for columns, each row's cells in them.
   */
  | {
      type: 'insertLines'
      sheet: string
      axis: SheetAxisName
      index: number
      count: number
      cells?: (SheetRow | null)[]
      sizes?: (number | null)[]
    }
  /** Removes `count` rows (or columns) from `index`, moving the rest up (or left). */
  | { type: 'removeLines'; sheet: string; axis: SheetAxisName; index: number; count: number }
  /**
   * Moves `count` rows (or columns) from `from` to before `to`, both
   * numbered as before the move.
   */
  | {
      type: 'moveLines'
      sheet: string
      axis: SheetAxisName
      from: number
      count: number
      to: number
    }
  /** Adds a sheet at `index`, moving the ones from there on along. */
  | { type: 'insertSheet'; index: number; data: SheetData }
  | { type: 'removeSheet'; sheet: string }
  /** Moves a sheet to `index`, counted after it is taken out. */
  | { type: 'moveSheet'; sheet: string; index: number }

export interface SheetTransactionMeta {
  /** Keep out of the undo history, e.g. a change from another client. */
  history?: boolean
  /** Consecutive transactions in the same group within a second undo as one. */
  group?: string
  /** Who made the change, passed on to the `transaction` event. */
  origin?: string
  /** What the change was; the grid sets it, a change made in code is `api`. */
  action?: SheetAction
}

/**
 * A batch of changes. Steps apply as they are added, so later calls see
 * earlier ones; `doc` is the result. Cells and ranges without a sheet are
 * on `sheet` (in the grid, the one shown).
 */
export class SheetTransaction {
  readonly steps: SheetStep[] = []
  /** What undoes each step, in the order the steps were made. */
  private undoing: SheetStep[] = []
  private reversed: SheetStep[] | null = null

  /** The steps that undo this transaction, in the order to apply them. */
  get inverse(): readonly SheetStep[] {
    // put in order when asked, as adding each to the front would take long for many steps
    // oxlint-disable-next-line unicorn/no-array-reverse -- reverses a fresh copy
    this.reversed ??= this.undoing.slice().reverse()
    return this.reversed
  }
  meta: SheetTransactionMeta = {}
  private book: SheetWorkbook
  /** What this transaction has copied, so it copies each thing once. */
  private own = { book: false, sheets: false, styles: false, types: false }
  /** The sheets this transaction copied, and the rows it copied of each. */
  private ownSheets = new WeakSet<SheetData>()
  private ownRows = new WeakMap<SheetData, Set<number>>()

  constructor(
    readonly before: SheetWorkbook,
    /** The sheet cells and ranges are on when they don't name one. */
    readonly sheet: SheetRef = 0,
  ) {
    this.book = before
  }

  get doc(): SheetWorkbook {
    return this.book
  }

  get changed() {
    return this.steps.length > 0
  }

  setMeta(meta: SheetTransactionMeta) {
    Object.assign(this.meta, meta)
    return this
  }

  /** The index of a sheet, by index, `id` or name; `-1` when there is none. */
  indexOf(ref: SheetRef = this.sheet) {
    const { sheets } = this.book
    if (typeof ref === 'number') return ref >= 0 && ref < sheets.length ? ref : -1
    const byId = sheets.findIndex((sheet) => sheet.id === ref)
    return byId === -1 ? sheets.findIndex((sheet) => sheet.id == null && sheet.name === ref) : byId
  }

  /** A sheet as it is now in this transaction. */
  getSheet(ref: SheetRef = this.sheet): SheetData {
    const index = this.indexOf(ref)
    if (index === -1) throw new RangeError(`There is no sheet "${ref}"`)
    return this.book.sheets[index]!
  }

  getCell(at: SheetCellAt): SheetCellInput {
    const { index, row, col } = this.cellAt(at)
    return this.book.sheets[index]!.cells[row]?.[col] ?? undefined
  }

  step(step: SheetStep) {
    const inverse = this.apply(step)
    if (inverse) {
      this.steps.push(step)
      this.undoing.push(inverse)
      this.reversed = null
    }
    return this
  }

  /** Replaces a cell; `undefined` empties it. */
  setCell(at: SheetCellAt, cell: SheetCellInput) {
    const { index, row, col } = this.cellAt(at)
    return this.step({ type: 'setCell', sheet: this.keyOf(index), row, col, cell })
  }

  /** Changes some of a cell's fields and keeps the rest. */
  updateCell(at: SheetCellAt, patch: Patch<SheetCell>) {
    const target = this.cellAt(at)
    const point = { sheet: target.index, row: target.row, col: target.col }
    return this.setCell(point, compactCell({ ...cellOf(this.getCell(point)), ...patch }))
  }

  /** Writes a cell's value and keeps its style and format. */
  setValue(at: SheetCellAt, value: SheetValue | undefined) {
    return this.updateCell(at, { value: value ?? undefined })
  }

  /** Empties the values in a range, keeping styles and formats. */
  clearValues(at: SheetRangeAt) {
    const { index, bounds } = this.rangeAt(at)
    const { cells } = this.book.sheets[index]!
    const last = Math.min(bounds.bottom, cells.length - 1)
    for (let row = bounds.top; row <= last; row++) {
      const line = cells[row]
      if (!line) continue
      const end = Math.min(bounds.right, line.length - 1)
      for (let col = bounds.left; col <= end; col++) {
        const cell = line[col]
        if (cell != null && cell !== '' && (typeof cell !== 'object' || cell.value != null))
          this.setValue({ sheet: index, row, col }, undefined)
      }
    }
    return this
  }

  /** Writes a cell's note; empty text or `undefined` takes it off. */
  setNote(at: SheetCellAt, note: string | undefined) {
    return this.updateCell(at, { note: note?.trim() ? note : undefined })
  }

  /** Takes the notes off the cells in a range, keeping what they hold. */
  clearNotes(at: SheetRangeAt) {
    const { index, bounds } = this.rangeAt(at)
    const { cells } = this.book.sheets[index]!
    const last = Math.min(bounds.bottom, cells.length - 1)
    for (let row = bounds.top; row <= last; row++) {
      const line = cells[row]
      if (!line) continue
      const end = Math.min(bounds.right, line.length - 1)
      for (let col = bounds.left; col <= end; col++) {
        const cell = line[col]
        if (cell && typeof cell === 'object' && cell.note != null)
          this.setNote({ sheet: index, row, col }, undefined)
      }
    }
    return this
  }

  /** Sets a row's height or a column's width in px; `undefined` for the default, `0` hides it. */
  setSize(axis: 'row' | 'col', index: number, size: number | undefined, sheet?: SheetRef) {
    const key = this.keyOf(this.mustIndex(sheet))
    return this.step({ type: 'setSize', sheet: key, axis, index, size })
  }

  /** Changes a sheet's name, freeze, row or column count. */
  updateSheet(patch: SheetPatch, sheet?: SheetRef) {
    return this.step({ type: 'updateSheet', sheet: this.keyOf(this.mustIndex(sheet)), patch })
  }

  setStyle(name: string, style: SheetStyle | undefined) {
    return this.step({ type: 'setStyle', name, style })
  }

  /** Adds, replaces or (with `undefined`) removes a named cell type, such as a list to pick from. */
  setType(name: string, setup: SheetTypeSetup | undefined) {
    return this.step({ type: 'setType', name, setup })
  }

  /**
   * Writes a block of cells with its top left corner at `at`, row by row.
   * `undefined` in the block empties a cell; a shorter row leaves the cells
   * past it as they are.
   */
  setCells(at: SheetCellAt, block: readonly (readonly SheetCellInput[])[]) {
    const { index, row, col } = this.cellAt(at)
    block.forEach((line, r) =>
      line.forEach((cell, c) => this.setCell({ sheet: index, row: row + r, col: col + c }, cell)),
    )
    return this
  }

  /**
   * Fills `to` from `from`, the cells it extends down, up, right or left:
   * each line of cells continues as the fill handle does (see
   * `continueValues`), with the styles and formats of the cells it repeats.
   * Formulas are copied with their references moved along. `mode` is
   * `auto` as dragging does, `series` to count a single number up too, or
   * `copy` to only repeat, as Ctrl+D does.
   */
  fill(from: SheetRangeAt, to: SheetRangeAt, options: { mode?: SheetFillMode } = {}) {
    const { index, bounds: s } = this.rangeAt(from)
    const t = this.rangeAt(to).bounds
    const vertical = t.left === s.left && t.right === s.right
    const horizontal = t.top === s.top && t.bottom === s.bottom
    if (vertical && horizontal) return this
    let direction: 'down' | 'up' | 'right' | 'left'
    if (vertical && t.top === s.top && t.bottom > s.bottom) direction = 'down'
    else if (vertical && t.bottom === s.bottom && t.top < s.top) direction = 'up'
    else if (horizontal && t.left === s.left && t.right > s.right) direction = 'right'
    else if (horizontal && t.right === s.right && t.left < s.left) direction = 'left'
    else throw new RangeError('The range to fill must extend the cells it is filled from')
    const down = direction === 'down' || direction === 'up'
    const forward = direction === 'down' || direction === 'right'
    const count = down
      ? t.bottom - t.top - (s.bottom - s.top)
      : t.right - t.left - (s.right - s.left)
    const length = down ? s.bottom - s.top + 1 : s.right - s.left + 1
    const lines = down ? [s.left, s.right] : [s.top, s.bottom]
    const cells = this.book.sheets[index]!.cells
    for (let line = lines[0]!; line <= lines[1]!; line++) {
      // the cells of the line in the order the fill continues them
      const points = Array.from({ length }, (_, i) => {
        const along = forward ? i : length - 1 - i
        return down ? { row: s.top + along, col: line } : { row: line, col: s.left + along }
      })
      const sources = points.map((p) => cells[p.row]?.[p.col] ?? undefined)
      const values = continueValues(sources.map(valueOf), count, {
        mode: options.mode,
        back: !forward,
      })
      for (let i = 0; i < count; i++) {
        const k = i % length
        const origin = points[k]!
        const step = (forward ? 1 : -1) * (length + i - k)
        const point = down
          ? { row: origin.row + step, col: line }
          : { row: line, col: origin.col + step }
        const source = cellOf(sources[k])
        const value = source?.value
        const next =
          typeof value === 'string' && value.startsWith('=')
            ? shiftFormula(value, point.row - origin.row, point.col - origin.col)
            : values[i]
        this.setCell(
          { sheet: index, ...point },
          compactCell({ ...source, value: next ?? undefined }),
        )
      }
    }
    return this
  }

  /**
   * Sorts the rows of a range by the values in `keys`' columns; the cells
   * outside the range stay. `header` keeps the first row in place. Equal rows
   * keep their order, and empty values go last either way. Formulas move
   * with their rows and their references move along, as when copied.
   * `valueAt` gives what a cell comes to, e.g. a formula's result; the value
   * as written is used without it. Ranges with merged cells are not sorted.
   */
  sortRange(
    at: SheetRangeAt,
    keys: readonly SheetSortKey[],
    options: {
      header?: boolean
      valueAt?: (row: number, col: number) => unknown
      lang?: string
    } = {},
  ) {
    const { index, bounds } = this.rangeIn(at)
    const sheet = this.book.sheets[index]!
    const top = bounds.top + (options.header ? 1 : 0)
    if (top >= bounds.bottom || !keys.length) return this
    const body = { ...bounds, top }
    if (mergesOf(sheet).touching(body).length)
      throw new RangeError('A range with merged cells cannot be sorted')
    const rows = Array.from({ length: bounds.bottom - top + 1 }, (_, i) => top + i)
    const cells = sheet.cells
    const valueAt =
      options.valueAt ?? ((row: number, col: number) => valueOf(cells[row]?.[col] ?? undefined))
    const order = sortRows(rows, keys, valueAt, textCollator(options.lang))
    // read the moved cells before writing any
    const moved = order.map((from) =>
      Array.from({ length: bounds.right - bounds.left + 1 }, (_, c) =>
        cellOf(cells[from]?.[bounds.left + c] ?? undefined),
      ),
    )
    order.forEach((from, i) => {
      const to = top + i
      if (from === to) return
      moved[i]!.forEach((cell, c) => {
        const value = cell?.value
        const next =
          typeof value === 'string' && value.startsWith('=')
            ? compactCell({ ...cell, value: shiftFormula(value, to - from, 0) })
            : compactCell(cell)
        this.setCell({ sheet: index, row: to, col: bounds.left + c }, next)
      })
    })
    return this
  }

  /**
   * Puts a filter on a range, headings in its first row; `null` takes the
   * filter off, showing the rows it hid. A new range drops the old rules.
   */
  setFilter(at: SheetRangeAt | null) {
    if (at == null) {
      const index = this.mustIndex()
      if (!this.book.sheets[index]!.filter) return this
      return this.updateSheet({ filter: undefined }, index)
    }
    const { index, bounds } = this.rangeIn(at)
    const old = this.book.sheets[index]!.filter
    const range = rangeText(bounds)
    if (old?.range === range) return this
    return this.updateSheet({ filter: { range } }, index)
  }

  /**
   * Sets which rows a column of the filter keeps; `undefined` keeps all.
   * `sorted` marks the column the rows were sorted by, for its button.
   */
  filterColumn(col: number, rule: SheetFilterRule | undefined, sheet: SheetRef = this.sheet) {
    const index = this.mustIndex(sheet)
    const filter = this.book.sheets[index]!.filter
    if (!filter) throw new RangeError('The sheet has no filter')
    const columns = { ...filter.columns }
    if (rule) columns[col] = rule
    else delete columns[col]
    const next: SheetFilter = {
      ...filter,
      columns: Object.keys(columns).length ? columns : undefined,
    }
    if (!next.columns) delete next.columns
    return this.updateSheet({ filter: next }, index)
  }

  /** Remembers the filter column the rows were sorted by, or forgets it with `undefined`. */
  markSorted(sorted: SheetFilter['sorted'], sheet: SheetRef = this.sheet) {
    const index = this.mustIndex(sheet)
    const filter = this.book.sheets[index]!.filter
    if (!filter) return this
    const next: SheetFilter = { ...filter, sorted }
    if (!sorted) delete next.sorted
    return this.updateSheet({ filter: next }, index)
  }

  /**
   * Adds a conditional format after the sheet's others; where two give the
   * same part of a cell's look, the earlier one wins. The format's `range`
   * names cells of `sheet`.
   */
  addConditionalFormat(format: SheetConditionalFormat, sheet: SheetRef = this.sheet) {
    return this.addRule('conditionalFormats', format, sheet)
  }

  /** Sets a sheet's conditional formats, in order, e.g. after moving one up; `[]` removes them all. */
  setConditionalFormats(formats: readonly SheetConditionalFormat[], sheet: SheetRef = this.sheet) {
    return this.setRules('conditionalFormats', formats, sheet)
  }

  /**
   * Removes the conditional formats whose cells overlap a range, such as
   * the selection; without a range, all of the sheet's.
   */
  clearConditionalFormats(at?: SheetRangeAt) {
    return this.clearRules('conditionalFormats', at)
  }

  /**
   * Adds a validation rule after the sheet's others; where two cover a
   * cell, the earlier one applies. The rule's `range` names cells of `sheet`.
   */
  addValidation(rule: SheetValidation, sheet: SheetRef = this.sheet) {
    return this.addRule('validations', rule, sheet)
  }

  /** Sets a sheet's validation rules, in order; `[]` removes them all. */
  setValidations(rules: readonly SheetValidation[], sheet: SheetRef = this.sheet) {
    return this.setRules('validations', rules, sheet)
  }

  /**
   * Removes the validation rules whose cells overlap a range, such as the
   * selection; without a range, all of the sheet's.
   */
  clearValidations(at?: SheetRangeAt) {
    return this.clearRules('validations', at)
  }

  private addRule<K extends RuleKey>(key: K, rule: RuleOf<K>, sheet: SheetRef) {
    const index = this.mustIndex(sheet)
    checkRuleRange(rule.range)
    const rules = (this.book.sheets[index]![key] ?? []) as RuleOf<K>[]
    return this.updateSheet({ [key]: [...rules, rule] }, index)
  }

  private setRules<K extends RuleKey>(key: K, rules: readonly RuleOf<K>[], sheet: SheetRef) {
    const index = this.mustIndex(sheet)
    for (const rule of rules) checkRuleRange(rule.range)
    return this.updateSheet({ [key]: rules.length ? [...rules] : undefined }, index)
  }

  private clearRules(key: RuleKey, at?: SheetRangeAt) {
    const { index, bounds } =
      at == null ? { index: this.mustIndex(), bounds: null } : this.rangeAt(at)
    const rules = this.book.sheets[index]![key]
    if (!rules?.length) return this
    const kept = bounds
      ? (rules as { range: SheetRuleRange }[]).filter((rule) =>
          rangesOf(rule.range).every((text) => {
            const range = parseRange(text)
            return range && !overlaps(boundsOf(range), bounds)
          }),
        )
      : []
    if (kept.length === rules.length) return this
    return this.updateSheet({ [key]: kept.length ? kept : undefined }, index)
  }

  /**
   * Groups rows so they can be folded away: `groupRows('3:8')` or
   * `groupRows(2, 6)`. A group may hold other groups, at most eight deep;
   * one beside a group of the same level joins it, and one that would cross
   * a group, or nest too deep, throws a `RangeError`.
   */
  groupRows(at: SheetLinesAt, count?: number, sheet?: SheetRef) {
    const lines = linesOf('row', at, count)
    return this.groupLines('row', lines.from, lines.count, sheet)
  }

  /** Groups columns so they can be folded away: `groupCols('B:D')`. */
  groupCols(at: SheetLinesAt, count?: number, sheet?: SheetRef) {
    const lines = linesOf('col', at, count)
    return this.groupLines('col', lines.from, lines.count, sheet)
  }

  /**
   * Takes rows out of their groups: the groups that lie within them go (the
   * outer ones, when groups nest); without any, the rows leave the innermost
   * group they are in, which may split it in two.
   */
  ungroupRows(at: SheetLinesAt, count?: number, sheet?: SheetRef) {
    const lines = linesOf('row', at, count)
    return this.ungroupLines('row', lines.from, lines.count, sheet)
  }

  /** Takes columns out of their groups, as `ungroupRows` does rows. */
  ungroupCols(at: SheetLinesAt, count?: number, sheet?: SheetRef) {
    const lines = linesOf('col', at, count)
    return this.ungroupLines('col', lines.from, lines.count, sheet)
  }

  /** Folds a group away: `collapseGroup('3:8')`, `range` being the group's rows or columns. */
  collapseGroup(range: string, sheet?: SheetRef) {
    return this.foldGroup(range, true, sheet)
  }

  /** Shows a folded group again: `expandGroup('3:8')`. */
  expandGroup(range: string, sheet?: SheetRef) {
    return this.foldGroup(range, false, sheet)
  }

  private foldGroup(range: string, collapsed: boolean, sheet: SheetRef = this.sheet) {
    const index = this.mustIndex(sheet)
    const data = this.book.sheets[index]!
    const span = groupSpan(range)
    const group = span && groupsOf(data).axis(span.axis).find(span.start, span.end)
    if (!group) throw new RangeError(`There is no group "${range}"`)
    if (group.collapsed === collapsed) return this
    return this.setGroups(index, (g, i) => (i === group.index ? { ...g, collapsed } : g))
  }

  /**
   * Shows the groups of an axis down to a level, as the outline's level
   * buttons do: level 1 folds every group, level 2 shows the outer groups
   * with theirs folded, and one past the deepest shows them all.
   */
  showGroupLevel(axis: SheetAxisName, level: number, sheet: SheetRef = this.sheet) {
    const index = this.mustIndex(sheet)
    const laid = groupsOf(this.book.sheets[index]!).axis(axis)
    const fold = new Map<number, boolean>()
    for (const g of laid.list) if (g.collapsed !== g.depth >= level) fold.set(g.index, !g.collapsed)
    if (!fold.size) return this
    return this.setGroups(index, (g, i) => (fold.has(i) ? { ...g, collapsed: fold.get(i) } : g))
  }

  private groupLines(axis: SheetAxisName, from: number, count: number, ref?: SheetRef) {
    if (count <= 0) return this
    const index = this.mustIndex(ref)
    const data = this.book.sheets[index]!
    let start = from
    let end = from + count - 1
    const laid = groupsOf(data).axis(axis)
    if (laid.find(start, end)) return this
    const problem = laid.problem(start, end)
    if (problem === 'deep')
      throw new RangeError(`"${groupRange(axis, start, end)}" would nest more than eight deep`)
    if (problem) {
      const other = groupRange(axis, problem.cross.start, problem.cross.end)
      throw new RangeError(`"${groupRange(axis, start, end)}" would cross the group "${other}"`)
    }
    // groups of the same level right beside it join it, as one group
    const joined = new Set<number>()
    for (const g of laid.beside(start, end)) {
      joined.add(g.index)
      start = Math.min(start, g.start)
      end = Math.max(end, g.end)
    }
    const kept = (data.groups ?? []).filter((_, i) => !joined.has(i))
    return this.updateSheet({ groups: [...kept, { range: groupRange(axis, start, end) }] }, index)
  }

  private ungroupLines(axis: SheetAxisName, from: number, count: number, ref?: SheetRef) {
    if (count <= 0) return this
    const index = this.mustIndex(ref)
    const data = this.book.sheets[index]!
    const laid = groupsOf(data).axis(axis)
    const end = from + count - 1
    const within = laid.list.filter((g) => g.start >= from && g.end <= end)
    if (within.length) {
      // the outer ones: those not inside another that goes
      const gone = new Set<number>()
      for (const g of within)
        if (
          !within.some((o) => o !== g && o.depth < g.depth && o.start <= g.start && o.end >= g.end)
        )
          gone.add(g.index)
      return this.setGroups(index, (g, i) => (gone.has(i) ? null : g))
    }
    // the lines leave the deepest groups they touch
    const touching = laid.list.filter((g) => g.start <= end && g.end >= from)
    if (!touching.length) return this
    const deepest = Math.max(...touching.map((g) => g.depth))
    const parts = new Map<number, SheetGroup[]>()
    for (const g of touching) {
      if (g.depth !== deepest) continue
      const group = data.groups![g.index]!
      const split: SheetGroup[] = []
      const keep = (a: number, b: number) => split.push({ ...group, range: groupRange(axis, a, b) })
      if (g.start < from) keep(g.start, from - 1)
      if (g.end > end) keep(end + 1, g.end)
      parts.set(g.index, split)
    }
    return this.setGroups(index, (g, i) => parts.get(i) ?? g)
  }

  /** Rewrites a sheet's groups: each to itself, another, several or none. */
  private setGroups(
    index: number,
    map: (group: SheetGroup, index: number) => SheetGroup | SheetGroup[] | null,
  ) {
    const next: SheetGroup[] = []
    this.book.sheets[index]!.groups?.forEach((g, i) => {
      const out = map(g, i)
      if (Array.isArray(out)) next.push(...out)
      else if (out) next.push(out)
    })
    return this.updateSheet({ groups: next.length ? next : undefined }, index)
  }

  /**
   * Adds empty rows before `at`: `insertRows(4, 2)` or `insertRows('5:6')`
   * both add two rows where row 5 was. Frozen rows and the row count grow
   * with them, and formulas pointing below follow their cells.
   */
  insertRows(at: SheetLinesAt, count?: number, sheet?: SheetRef) {
    const lines = linesOf('row', at, count)
    return this.insertLines('row', lines.from, lines.count, sheet)
  }

  /** Adds empty columns before `at`, `insertCols('C')` or `insertCols(2)`. */
  insertCols(at: SheetLinesAt, count?: number, sheet?: SheetRef) {
    const lines = linesOf('col', at, count)
    return this.insertLines('col', lines.from, lines.count, sheet)
  }

  /**
   * Removes rows with their cells and heights: `deleteRows('5:7')` or
   * `deleteRows(4, 3)`. Formulas pointing at them read `#REF!`.
   */
  deleteRows(at: SheetLinesAt, count?: number, sheet?: SheetRef) {
    const lines = linesOf('row', at, count)
    return this.deleteLines('row', lines.from, lines.count, sheet)
  }

  /** Removes columns with their cells and widths: `deleteCols('B:C')`. */
  deleteCols(at: SheetLinesAt, count?: number, sheet?: SheetRef) {
    const lines = linesOf('col', at, count)
    return this.deleteLines('col', lines.from, lines.count, sheet)
  }

  /**
   * Moves rows to before row `to`, numbered as before the move:
   * `moveRows('2:3', '6')` puts rows 2 and 3 above what was row 6.
   * Formulas pointing at them follow.
   */
  moveRows(lines: SheetLinesAt, to: number | string, sheet?: SheetRef) {
    const { from, count } = linesOf('row', lines)
    return this.moveLines('row', from, count, linesOf('row', to).from, sheet)
  }

  /** Moves columns to before column `to`: `moveCols('C', 'A')`. */
  moveCols(lines: SheetLinesAt, to: number | string, sheet?: SheetRef) {
    const { from, count } = linesOf('col', lines)
    return this.moveLines('col', from, count, linesOf('col', to).from, sheet)
  }

  /**
   * Moves a block of cells so its top left corner is at `to`, as cutting
   * and pasting does: the cells at `from` empty, those at `to` are
   * replaced, and formulas pointing at the block follow it.
   */
  moveCells(from: SheetRangeAt, to: SheetCellAt) {
    const source = this.rangeAt(from)
    const target = this.cellAt(to)
    const b = source.bounds
    const rows = target.row - b.top
    const cols = target.col - b.left
    if (rows === 0 && cols === 0 && source.index === target.index) return this
    const cells = this.book.sheets[source.index]!.cells
    const block = Array.from({ length: b.bottom - b.top + 1 }, (_, r) =>
      Array.from({ length: b.right - b.left + 1 }, (_cell, c) => cells[b.top + r]?.[b.left + c]),
    )
    for (let r = b.top; r <= b.bottom; r++)
      for (let c = b.left; c <= b.right; c++)
        this.setCell({ sheet: source.index, row: r, col: c }, undefined)
    this.setCells(target, block)
    const dest: SheetBounds = {
      top: target.row,
      left: target.col,
      bottom: b.bottom + rows,
      right: b.right + cols,
    }
    const sourceName = this.book.sheets[source.index]!.name
    const destName = this.book.sheets[target.index]!.name
    const same = sourceName === destName
    // references to the cells the block replaced lose them
    this.rewriteReferences(destName, (r) => (inside(r, dest) && !(same && inside(r, b)) ? null : r))
    // references to the block follow it
    this.rewriteReferences(sourceName, (r) => {
      if (!inside(r, b)) return r
      const moved = {
        top: r.top + rows,
        left: r.left + cols,
        bottom: r.bottom + rows,
        right: r.right + cols,
      }
      return same ? moved : { sheet: destName, bounds: moved }
    })
    return this
  }

  private insertLines(axis: SheetAxisName, index: number, count: number, ref?: SheetRef) {
    if (count <= 0) return this
    const at = this.mustIndex(ref)
    const sheet = this.book.sheets[at]!
    this.step({ type: 'insertLines', sheet: this.keyOf(at), axis, index, count })
    this.updateSheet(
      linesPatch(sheet, axis, (n) => (n > index ? n + count : n), count),
      at,
    )
    const add = (n: number) => (n >= index ? n + count : n)
    return this.moveRanges(
      at,
      lineMap(axis, (a, b) => [add(a), add(b)]),
    )
  }

  private deleteLines(axis: SheetAxisName, index: number, count: number, ref?: SheetRef) {
    if (count <= 0) return this
    const at = this.mustIndex(ref)
    const sheet = this.book.sheets[at]!
    this.step({ type: 'removeLines', sheet: this.keyOf(at), axis, index, count })
    // frozen lines that were removed are no longer frozen
    const left = (n: number) => n - Math.max(0, Math.min(n, index + count) - index)
    this.updateSheet(linesPatch(sheet, axis, left, -count), at)
    const end = index + count
    return this.moveRanges(
      at,
      lineMap(axis, (a, b) => {
        if (a >= index && b < end) return null
        const first = a < index ? a : a >= end ? a - count : index
        const last = b < index ? b : b >= end ? b - count : index - 1
        return [first, last]
      }),
    )
  }

  private moveLines(axis: SheetAxisName, from: number, count: number, to: number, ref?: SheetRef) {
    if (count <= 0 || (to >= from && to <= from + count)) return this
    const at = this.mustIndex(ref)
    this.step({ type: 'moveLines', sheet: this.keyOf(at), axis, from, count, to })
    const place = movedIndex(from, count, to)
    return this.moveRanges(
      at,
      lineMap(axis, (a, b) => {
        const x = place(a)
        const y = place(b)
        return [Math.min(x, y), Math.max(x, y)]
      }),
    )
  }

  /**
   * After rows or columns of a sheet change: rewrites formulas pointing at
   * it, and moves its merged cells, dropping those that are gone or now
   * one cell.
   */
  private moveRanges(index: number, map: SheetRefMap) {
    const sheet = this.book.sheets[index]!
    this.rewriteReferences(sheet.name, map)
    this.moveFilter(index, map)
    this.moveRules('conditionalFormats', index, map)
    this.moveRules('validations', index, map)
    this.moveGroups(index, map)
    const merges = sheet.merges
    if (!merges?.length) return this
    const next: string[] = []
    for (const text of merges) {
      const range = parseRange(text)
      if (!range) continue
      const moved = map(boundsOf(range))
      if (!moved) continue
      const b = 'bounds' in moved ? moved.bounds : moved
      if (b.top === b.bottom && b.left === b.right) continue
      next.push(rangeText(b))
    }
    const same = next.length === merges.length && next.every((m, i) => m === merges[i])
    return same ? this : this.updateSheet({ merges: next.length ? next : undefined }, index)
  }

  /** Moves a sheet's rules with their cells; a rule goes when its cells do. */
  private moveRules(key: RuleKey, index: number, map: SheetRefMap) {
    const rules = this.book.sheets[index]![key] as { range: SheetRuleRange }[] | undefined
    if (!rules?.length) return
    const next: { range: SheetRuleRange }[] = []
    for (const rule of rules) {
      // each range moves on its own; the rule goes when all of them do
      const texts: string[] = []
      for (const text of rangesOf(rule.range)) {
        const range = parseRange(text)
        const moved = range && map(boundsOf(range))
        if (moved) texts.push(rangeText('bounds' in moved ? moved.bounds : moved))
      }
      if (!texts.length) continue
      const range = Array.isArray(rule.range) ? texts : texts[0]!
      const same = Array.isArray(rule.range)
        ? texts.length === rule.range.length && texts.every((t, i) => t === rule.range[i])
        : range === rule.range
      next.push(same ? rule : { ...rule, range })
    }
    if (next.length !== rules.length || next.some((rule, i) => rule !== rules[i]))
      this.updateSheet({ [key]: next.length ? next : undefined }, index)
  }

  /** Moves a sheet's groups with their lines; a group goes when its lines do. */
  private moveGroups(index: number, map: SheetRefMap) {
    const groups = this.book.sheets[index]!.groups
    if (!groups?.length) return
    const next: SheetGroup[] = []
    for (const group of groups) {
      const range = parseRange(group.range)
      const moved = range && map(boundsOf(range))
      if (!moved) continue
      const text = rangeText('bounds' in moved ? moved.bounds : moved)
      next.push(text === group.range ? group : { ...group, range: text })
    }
    if (next.length !== groups.length || next.some((g, i) => g !== groups[i]))
      this.updateSheet({ groups: next.length ? next : undefined }, index)
  }

  /** Moves a sheet's filter with its rows and columns; it goes when its range does. */
  private moveFilter(index: number, map: SheetRefMap) {
    const filter = this.book.sheets[index]!.filter
    if (!filter) return
    const range = parseRange(filter.range)
    const moved = range && map(boundsOf(range))
    if (!moved) {
      this.updateSheet({ filter: undefined }, index)
      return
    }
    const b = 'bounds' in moved ? moved.bounds : moved
    const columns: Record<number, SheetFilterRule> = {}
    for (const [key, rule] of Object.entries(filter.columns ?? {})) {
      const col = Number(key)
      const to = map({ top: b.top, bottom: b.top, left: col, right: col })
      if (!to) continue
      const at = 'bounds' in to ? to.bounds : to
      if (at.left === at.right) columns[at.left] = rule
    }
    const next: SheetFilter = { range: rangeText(b) }
    if (Object.keys(columns).length) next.columns = columns
    if (filter.sorted) {
      const col = filter.sorted.col
      const to = map({ top: b.top, bottom: b.top, left: col, right: col })
      const at = to && ('bounds' in to ? to.bounds : to)
      if (at && at.left === at.right) next.sorted = { ...filter.sorted, col: at.left }
    }
    if (JSON.stringify(next) !== JSON.stringify(filter)) this.updateSheet({ filter: next }, index)
  }

  /**
   * Merges a range into one cell. Merges it touches are taken into it. The
   * top left cell keeps its content; the values of the other cells are
   * cleared, keeping their styles, unless `keep` leaves them hidden under the
   * merge, to show again when it is split.
   */
  mergeCells(at: SheetRangeAt, options: { keep?: boolean } = {}) {
    const { index, bounds } = this.rangeAt(at)
    const sheet = this.book.sheets[index]!
    const b = mergesOf(sheet).expand(bounds)
    if (b.top === b.bottom && b.left === b.right) return this
    if (!options.keep)
      for (let row = b.top; row <= b.bottom; row++)
        for (let col = b.left; col <= b.right; col++)
          if ((row !== b.top || col !== b.left) && valueOf(sheet.cells[row]?.[col]) != null)
            this.setValue({ sheet: index, row, col }, undefined)
    const kept = (sheet.merges ?? []).filter((text) => {
      const range = parseRange(text)
      return !range || !overlaps(boundsOf(range), b)
    })
    return this.updateSheet({ merges: [...kept, rangeText(b)] }, index)
  }

  /** Splits the merged cells a range touches back into single cells. */
  unmergeCells(at: SheetRangeAt) {
    const { index, bounds } = this.rangeAt(at)
    const sheet = this.book.sheets[index]!
    if (!sheet.merges?.length) return this
    const kept = sheet.merges.filter((text) => {
      const range = parseRange(text)
      return !range || !overlaps(boundsOf(range), bounds)
    })
    if (kept.length === sheet.merges.length) return this
    return this.updateSheet({ merges: kept.length ? kept : undefined }, index)
  }

  /**
   * Changes how the cells in a range look: each cell's style with `patch`
   * laid over it, where a field set to `undefined` (or `false`) is taken
   * off; `null` takes the whole style off. Cells that end up looking the
   * same share one style: one in `styles` that matches, or a new one named
   * `s1`, `s2`…. Whole columns and rows stop at the sheet's edge.
   */
  styleCells(at: SheetRangeAt, patch: SheetStylePatch | null) {
    const { index, bounds } = this.rangeIn(at)
    // a cell's style name → the name it changes to, worked out once per name
    const next = new Map<string | undefined, string | undefined>()
    for (let row = bounds.top; row <= bounds.bottom; row++)
      for (let col = bounds.left; col <= bounds.right; col++) {
        const point = { sheet: index, row, col }
        const style = cellOf(this.getCell(point))?.style
        if (!next.has(style)) next.set(style, this.styleFor(style, patch))
        const name = next.get(style)
        if (name !== style) this.updateCell(point, { style: name })
      }
    return this
  }

  /**
   * Sets the number or date format of the cells in a range (`undefined`
   * for none), or changes each with a function of its format and value,
   * such as `(format, value) => changeDecimals(format, value, 1)`.
   */
  formatCells(
    at: SheetRangeAt,
    format:
      string | undefined | ((format: string | undefined, value: SheetValue) => string | undefined),
  ) {
    const { index, bounds } = this.rangeIn(at)
    for (let row = bounds.top; row <= bounds.bottom; row++)
      for (let col = bounds.left; col <= bounds.right; col++) {
        const point = { sheet: index, row, col }
        const input = this.getCell(point)
        const old = cellOf(input)?.format
        const value = typeof format === 'function' ? format(old, valueOf(input)) : format
        if ((value || undefined) !== old) this.updateCell(point, { format: value || undefined })
      }
    return this
  }

  /** The name of a style that looks like `name`'s with `patch` laid over it. */
  private styleFor(name: string | undefined, patch: SheetStylePatch | null) {
    const styles = this.book.styles ?? {}
    const style: SheetStyle = {}
    if (patch)
      for (const [key, value] of Object.entries({ ...(name ? styles[name] : undefined), ...patch }))
        if (value !== undefined && value !== false && value !== '')
          (style as Record<string, unknown>)[key] = value
    const key = styleKey(style)
    if (key === '{}') return undefined
    if (name && styles[name] && styleKey(styles[name]) === key) return name
    for (const [other, look] of Object.entries(styles)) if (styleKey(look) === key) return other
    let n = 1
    while (styles[`s${n}`]) n++
    this.setStyle(`s${n}`, style)
    return `s${n}`
  }

  /**
   * Adds a sheet, at the end or at `index`. Its name must not be taken
   * (`uniqueName` gives one that isn't); it is `Sheet1`, `Sheet2`… when
   * left out, whatever the language. Returns the transaction; the new sheet
   * is `tr.getSheet(name)`.
   */
  addSheet(sheet: Partial<SheetData> = {}, index = this.book.sheets.length) {
    const name = sheet.name ?? this.freeName('Sheet')
    this.checkName(name, sheet.id)
    const data: SheetData = { ...sheet, name, cells: sheet.cells ?? [] }
    return this.step({ type: 'insertSheet', index, data })
  }

  /**
   * Removes a sheet. The last one stays: a workbook always has a sheet.
   * Formulas on other sheets pointing at it read `#REF!`.
   */
  removeSheet(sheet: SheetRef = this.sheet) {
    const index = this.mustIndex(sheet)
    if (this.book.sheets.length < 2) return this
    const { name } = this.book.sheets[index]!
    this.step({ type: 'removeSheet', sheet: this.keyOf(index) })
    return this.rewriteFormulas((formula) => dropReferences(formula, name))
  }

  /** Moves a sheet to `index`, counted among the sheets without it. */
  moveSheet(sheet: SheetRef, index: number) {
    return this.step({ type: 'moveSheet', sheet: this.keyOf(this.mustIndex(sheet)), index })
  }

  /** Renames a sheet; formulas naming it follow. The name must not be taken. */
  renameSheet(sheet: SheetRef, name: string) {
    const index = this.mustIndex(sheet)
    const old = this.book.sheets[index]!
    if (old.name === name) return this
    this.checkName(name, old.id, index)
    this.updateSheet({ name }, index)
    return this.rewriteFormulas((formula) => renameReferences(formula, old.name, name))
  }

  /**
   * Adds a copy of a sheet right after it, named `name` or the sheet's name
   * with a number, such as `数据 (2)`. Formulas on the copy that name the
   * sheet keep pointing at the original.
   */
  duplicateSheet(sheet: SheetRef = this.sheet, name?: string) {
    const index = this.mustIndex(sheet)
    const original = this.book.sheets[index]!
    const { id: _id, ...source } = original
    // the copy shares the rows: changing either from here on copies them first
    this.ownSheets.delete(original)
    this.ownRows.delete(original)
    const next = name ?? this.uniqueName(source.name)
    this.checkName(next)
    return this.step({ type: 'insertSheet', index: index + 1, data: { ...source, name: next } })
  }

  /**
   * `name` if no sheet has it, otherwise the name with the first free
   * number: `门店 (2)`, `门店 (3)`…
   */
  uniqueName(name: string) {
    const taken = new Set(this.book.sheets.map((sheet) => sheet.name))
    if (!taken.has(name)) return name
    let n = 2
    while (taken.has(`${name} (${n})`)) n++
    return `${name} (${n})`
  }

  /** Passes every formula of the workbook through `rewrite`. */
  private rewriteFormulas(rewrite: (formula: string) => string) {
    this.book.sheets.forEach((sheet, index) =>
      sheet.cells.forEach((line, row) =>
        line?.forEach((cell, col) => {
          const value = typeof cell === 'object' ? cell?.value : cell
          if (typeof value !== 'string' || !value.startsWith('=')) return
          const next = rewrite(value)
          if (next !== value) this.setValue({ sheet: index, row, col }, next)
        }),
      ),
    )
    return this.rewriteRuleFormulas((formula) => rewrite(formula))
  }

  /**
   * Rewrites the formulas of every sheet's rules: conditional formats' and
   * validations' formulas, and the references of validation lists.
   */
  private rewriteRuleFormulas(rewrite: (formula: string, sheet: SheetData) => string) {
    this.book.sheets.forEach((sheet, index) => {
      for (const key of ['conditionalFormats', 'validations'] as const) {
        const rules = sheet[key] as RuleOf<RuleKey>[] | undefined
        if (!rules?.length) continue
        let changed = false
        const next = rules.map((rule) => {
          if ('formula' in rule) {
            const formula = rewrite(rule.formula, sheet)
            if (formula === rule.formula) return rule
            changed = true
            return { ...rule, formula }
          }
          if ('list' in rule && typeof rule.list === 'string') {
            const list = rewrite(rule.list, sheet)
            if (list === rule.list) return rule
            changed = true
            return { ...rule, list }
          }
          return rule
        })
        if (changed) this.updateSheet({ [key]: next }, index)
      }
    })
    return this
  }

  /** The first name `prefix` + a number, from the count of sheets on, that no sheet has. */
  private freeName(prefix: string) {
    const taken = new Set(this.book.sheets.map((sheet) => sheet.name))
    let n = this.book.sheets.length + 1
    while (taken.has(`${prefix}${n}`)) n++
    return `${prefix}${n}`
  }

  private checkName(name: string, id?: string, self = -1) {
    if (!name.trim()) throw new RangeError('A sheet needs a name')
    this.book.sheets.forEach((sheet, i) => {
      if (i === self) return
      if (sheet.name === name) throw new RangeError(`There is a sheet "${name}" already`)
      if (id != null && sheet.id === id) throw new RangeError(`There is a sheet "${id}" already`)
    })
  }

  /** Rewrites the references to cells on sheet `name` in every formula of the workbook. */
  private rewriteReferences(name: string, map: SheetRefMap) {
    this.book.sheets.forEach((sheet, index) => {
      sheet.cells.forEach((line, row) =>
        line?.forEach((cell, col) => {
          const value = typeof cell === 'object' ? cell?.value : cell
          if (typeof value !== 'string' || !value.startsWith('=')) return
          const next = moveReferences(value, sheet.name, name, map)
          if (next !== value) this.setValue({ sheet: index, row, col }, next)
        }),
      )
    })
    return this.rewriteRuleFormulas((formula, sheet) =>
      moveReferences(formula, sheet.name, name, map),
    )
  }

  private mustIndex(ref: SheetRef = this.sheet) {
    const index = this.indexOf(ref)
    if (index === -1) throw new RangeError(`There is no sheet "${ref}"`)
    return index
  }

  private keyOf(index: number) {
    return sheetKey(this.book.sheets[index]!)
  }

  private cellAt(at: SheetCellAt) {
    if (typeof at === 'string') {
      const { sheet, ref } = splitSheet(at)
      const point = parseCell(ref)
      if (!point) throw new RangeError(`"${at}" isn't a cell`)
      return { index: this.mustIndex(sheet), ...point }
    }
    return { index: this.mustIndex(at.sheet), row: at.row, col: at.col }
  }

  private rangeAt(at: SheetRangeAt) {
    let sheet: SheetRef | undefined
    let bounds: SheetBounds
    if (typeof at === 'string') {
      const split = splitSheet(at)
      sheet = split.sheet
      const range = parseRange(split.ref)
      if (!range) throw new RangeError(`"${at}" isn't a range`)
      bounds = boundsOf(range)
    } else {
      sheet = at.sheet
      bounds =
        'start' in at
          ? boundsOf(at)
          : { top: at.top, left: at.left, bottom: at.bottom, right: at.right }
    }
    return { index: this.mustIndex(sheet), bounds }
  }

  /** A range kept inside its sheet, so whole columns and rows end at its edge. */
  private rangeIn(at: SheetRangeAt) {
    const { index, bounds } = this.rangeAt(at)
    const sheet = this.book.sheets[index]!
    return {
      index,
      bounds: {
        top: Math.max(0, bounds.top),
        left: Math.max(0, bounds.left),
        bottom: Math.min(rowCountOf(sheet) - 1, bounds.bottom),
        right: Math.min(colCountOf(sheet) - 1, bounds.right),
      },
    }
  }

  /** Applies a step, returning the step that undoes it, or `null` when nothing changes. */
  private apply(step: SheetStep): SheetStep | null {
    if (step.type === 'setStyle') {
      const old = this.book.styles?.[step.name]
      if (old === step.style) return null
      const book = this.ownBook()
      const styles = this.own.styles ? book.styles! : { ...book.styles }
      this.own.styles = true
      if (step.style) styles[step.name] = step.style
      else delete styles[step.name]
      book.styles = styles
      return { type: 'setStyle', name: step.name, style: old }
    }
    if (step.type === 'setType') {
      const old = this.book.types?.[step.name]
      if (old === step.setup) return null
      const book = this.ownBook()
      const types = this.own.types ? book.types! : { ...book.types }
      this.own.types = true
      if (step.setup) types[step.name] = step.setup
      else delete types[step.name]
      book.types = types
      return { type: 'setType', name: step.name, setup: old }
    }
    if (step.type === 'insertSheet') {
      const sheets = this.ownList()
      const index = Math.max(0, Math.min(sheets.length, step.index))
      sheets.splice(index, 0, step.data)
      return { type: 'removeSheet', sheet: sheetKey(step.data) }
    }
    const index = this.mustIndex(step.sheet)
    const sheet = this.book.sheets[index]!
    switch (step.type) {
      case 'removeSheet': {
        this.ownList().splice(index, 1)
        // what the undo step keeps must not change, even if the sheet comes back
        this.ownSheets.delete(sheet)
        this.ownRows.delete(sheet)
        return { type: 'insertSheet', index, data: sheet }
      }
      case 'moveSheet': {
        const sheets = this.book.sheets
        const to = Math.max(0, Math.min(sheets.length - 1, step.index))
        if (to === index) return null
        const list = this.ownList()
        list.splice(index, 1)
        list.splice(to, 0, sheet)
        return { type: 'moveSheet', sheet: step.sheet, index }
      }
      case 'setCell': {
        const { row, col } = step
        const cell = step.cell ?? undefined
        const old = sheet.cells[row]?.[col] ?? undefined
        if (old === cell || (old == null && cell == null)) return null
        this.row(index, row)[col] = cell
        return { ...step, cell: old }
      }
      case 'setSize': {
        const key = step.axis === 'row' ? 'rowSizes' : 'colSizes'
        const sizes = sheet[key]
        const old = sizes?.[step.index]
        if (old === step.size) return null
        const next = { ...sizes }
        if (step.size == null) delete next[step.index]
        else next[step.index] = step.size
        this.ownSheet(index)[key] = next
        return { ...step, size: old }
      }
      case 'updateSheet': {
        const old: Record<string, unknown> = {}
        let changed = false
        for (const key of Object.keys(step.patch) as (keyof SheetPatch)[]) {
          old[key] = sheet[key]
          if (sheet[key] !== step.patch[key]) changed = true
        }
        if (!changed) return null
        const own = this.ownSheet(index) as unknown as Record<string, unknown>
        for (const [key, value] of Object.entries(step.patch)) {
          if (value === undefined) delete own[key]
          else own[key] = value
        }
        // a rename changes the key of a sheet without an id
        return { type: 'updateSheet', sheet: this.keyOf(index), patch: old as SheetPatch }
      }
      case 'insertLines':
        return this.insertAt(index, step)
      case 'removeLines':
        return this.removeAt(index, step)
      case 'moveLines':
        return this.moveAt(index, step)
    }
  }

  private insertAt(index: number, step: Extract<SheetStep, { type: 'insertLines' }>): SheetStep {
    const { axis, count } = step
    const at = step.index
    const own = this.ownSheet(index)
    const fill = step.cells
    if (axis === 'row') {
      if (at < own.cells.length || fill?.some((line) => line?.length)) {
        while (own.cells.length < at) own.cells.push(null)
        own.cells.splice(at, 0, ...Array.from({ length: count }, (_, i) => fill?.[i] ?? null))
      }
      // rows moved: what was copied is now at other numbers
      this.ownRows.delete(own)
    } else {
      const length = Math.max(own.cells.length, fill?.length ?? 0)
      for (let r = 0; r < length; r++) {
        const line = own.cells[r]
        const part = fill?.[r]
        if (!part?.length && (!line || line.length <= at)) continue
        const next = this.row(index, r)
        while (next.length < at) next.push(undefined)
        next.splice(at, 0, ...Array.from({ length: count }, (_, i) => part?.[i] ?? undefined))
      }
    }
    shiftSizes(own, axis, (n) => (n >= at ? n + count : n), at, step.sizes)
    return { type: 'removeLines', sheet: step.sheet, axis, index: at, count }
  }

  private removeAt(index: number, step: Extract<SheetStep, { type: 'removeLines' }>): SheetStep {
    const { axis, count } = step
    const at = step.index
    const own = this.ownSheet(index)
    let cells: (SheetRow | null)[] | undefined
    if (axis === 'row') {
      if (at < own.cells.length) cells = own.cells.splice(at, count).map((line) => line ?? null)
      this.ownRows.delete(own)
    } else {
      for (let r = 0; r < own.cells.length; r++) {
        const line = own.cells[r]
        if (!line || line.length <= at) continue
        const removed = this.row(index, r).splice(at, count)
        if (removed.some((cell) => cell != null)) (cells ??= [])[r] = removed
      }
      if (cells) for (let r = 0; r < cells.length; r++) cells[r] ??= null
    }
    const sizeKey = axis === 'row' ? 'rowSizes' : 'colSizes'
    const old = own[sizeKey]
    let sizes: (number | null)[] | undefined
    if (old)
      for (let i = 0; i < count; i++)
        if (old[at + i] != null)
          (sizes ??= Array<number | null>(count).fill(null))[i] = old[at + i]!
    shiftSizes(own, axis, (n) => (n < at ? n : n >= at + count ? n - count : -1))
    const inverse: SheetStep = { type: 'insertLines', sheet: step.sheet, axis, index: at, count }
    if (cells) inverse.cells = cells
    if (sizes) inverse.sizes = sizes
    return inverse
  }

  private moveAt(index: number, step: Extract<SheetStep, { type: 'moveLines' }>): SheetStep {
    const { axis, from, count, to } = step
    const own = this.ownSheet(index)
    const place = movedIndex(from, count, to)
    const reorder = <T>(list: T[], empty: T) => {
      const end = Math.max(from + count, to)
      if (list.length <= Math.min(from, to)) return list
      const out = list.slice()
      while (out.length < end) out.push(empty)
      for (let i = Math.min(from, to); i < end; i++) out[place(i)] = list[i] ?? empty
      while (out.length && out[out.length - 1] == null) out.pop()
      return out
    }
    if (axis === 'row') {
      own.cells = reorder(own.cells, null)
      this.ownRows.delete(own)
    } else
      for (let r = 0; r < own.cells.length; r++) {
        const line = own.cells[r]
        if (!line || line.length <= Math.min(from, to)) continue
        const next = reorder(line, undefined)
        if (next !== line) own.cells[r] = next
      }
    shiftSizes(own, axis, place)
    const back = to > from ? to - count : to
    return {
      type: 'moveLines',
      sheet: step.sheet,
      axis,
      from: back,
      count,
      to: to > from ? from : from + count,
    }
  }

  private ownBook() {
    if (!this.own.book) {
      this.book = { ...this.book }
      this.own.book = true
    }
    return this.book
  }

  /** The list of sheets as an array this transaction may change. */
  private ownList() {
    const book = this.ownBook()
    if (!this.own.sheets) {
      book.sheets = book.sheets.slice()
      this.own.sheets = true
    }
    return book.sheets
  }

  private ownSheet(index: number) {
    const book = this.ownBook()
    this.ownList()
    let sheet = book.sheets[index]!
    if (!this.ownSheets.has(sheet)) {
      sheet = book.sheets[index] = { ...sheet, cells: sheet.cells.slice() }
      this.ownSheets.add(sheet)
    }
    return sheet
  }

  /** The row as an array this transaction may change. */
  private row(sheet: number, row: number): SheetRow {
    const own = this.ownSheet(sheet)
    let rows = this.ownRows.get(own)
    if (!rows) this.ownRows.set(own, (rows = new Set()))
    if (!rows.has(row)) {
      own.cells[row] = own.cells[row]?.slice() ?? []
      rows.add(row)
    }
    return own.cells[row]!
  }
}

const rangeText = (b: SheetBounds) =>
  formatRange({ start: { row: b.top, col: b.left }, end: { row: b.bottom, col: b.right } })

/** Whether `x` lies inside `y`. */
const inside = (x: SheetBounds, y: SheetBounds) =>
  x.top >= y.top && x.bottom <= y.bottom && x.left >= y.left && x.right <= y.right

/** Rows or columns written as a number, `'5:7'` or `'B:C'`, as a first line and a count. */
function linesOf(axis: SheetAxisName, at: SheetLinesAt, count?: number) {
  if (typeof at === 'number') return { from: at, count: count ?? 1 }
  if (typeof at === 'object') return at
  const [a = '', b = a, extra] = at.replaceAll('$', '').trim().split(':')
  const line = (text: string) =>
    axis === 'row' ? (/^[1-9]\d*$/.test(text) ? Number(text) - 1 : -1) : columnIndex(text)
  const first = line(a!)
  const last = line(b)
  if (extra != null || first < 0 || last < 0)
    throw new RangeError(`"${at}" isn't ${axis === 'row' ? 'rows' : 'columns'}`)
  return { from: Math.min(first, last), count: count ?? Math.abs(last - first) + 1 }
}

/**
 * A reference map for a change to rows or columns: `span` gives a range's
 * new first and last line on that axis, or `null` when they are gone.
 * Whole rows are not touched by a change to columns, and so on.
 */
function lineMap(
  axis: SheetAxisName,
  span: (a: number, b: number) => [number, number] | null,
): SheetRefMap {
  return (b) => {
    const [a, z] = axis === 'row' ? [b.top, b.bottom] : [b.left, b.right]
    // whole columns for rows, whole rows for columns
    if (a === 0 && z === Infinity) return b
    const next = span(a, z === Infinity ? a : z)
    if (!next) return null
    const last = z === Infinity ? Infinity : next[1]
    return axis === 'row'
      ? { ...b, top: next[0], bottom: last }
      : { ...b, left: next[0], right: last }
  }
}

/** Where line `i` ends up when `count` lines from `from` move to before `to`. */
export function movedIndex(from: number, count: number, to: number) {
  return (i: number) => {
    if (i >= from && i < from + count) return to > from ? i - from + to - count : i - from + to
    if (to > from && i >= from + count && i < to) return i - count
    if (to < from && i >= to && i < from) return i + count
    return i
  }
}

/** Renumbers a sheet's changed sizes; a number below 0 drops the size. */
function shiftSizes(
  sheet: SheetData,
  axis: SheetAxisName,
  to: (n: number) => number,
  insertAt?: number,
  inserted?: (number | null)[],
) {
  const key = axis === 'row' ? 'rowSizes' : 'colSizes'
  const old = sheet[key]
  if (!old && !inserted?.some((size) => size != null)) return
  const next: Record<number, number> = {}
  for (const [n, size] of Object.entries(old ?? {})) {
    const moved = to(Number(n))
    if (moved >= 0) next[moved] = size
  }
  inserted?.forEach((size, i) => {
    if (size != null) next[insertAt! + i] = size
  })
  sheet[key] = next
}

/** The frozen count and line count after lines are added or removed. */
function linesPatch(
  sheet: SheetData,
  axis: SheetAxisName,
  frozen: (n: number) => number,
  change: number,
): SheetPatch {
  const patch: SheetPatch = {}
  const countKey = axis === 'row' ? 'rowCount' : 'colCount'
  const freezeKey = axis === 'row' ? 'rows' : 'cols'
  const count = sheet[countKey]
  if (count != null) patch[countKey] = Math.max(1, count + change)
  const freeze = sheet.freeze?.[freezeKey]
  if (freeze) {
    const next = frozen(freeze)
    if (next !== freeze) patch.freeze = { ...sheet.freeze, [freezeKey]: next }
  }
  return patch
}

/** Applies steps to a workbook, as one transaction. */
export function applySheetSteps(doc: SheetWorkbook, steps: readonly SheetStep[]) {
  const tr = new SheetTransaction(doc)
  for (const step of steps) tr.step(step)
  return tr
}

const keyOf = (step: SheetStep) => {
  switch (step.type) {
    case 'setCell':
      return `c${step.sheet}:${step.row}:${step.col}`
    case 'setSize':
      return `s${step.sheet}:${step.axis}:${step.index}`
    case 'setStyle':
      return `y${step.name}`
    case 'setType':
      return `t${step.name}`
    default:
      return null
  }
}

/**
 * The same changes in fewer steps: of several steps writing the same cell,
 * size or style, keeps only the last, which is the one that counts.
 */
export function compactSheetSteps(steps: readonly SheetStep[]) {
  const out: SheetStep[] = []
  const at = new Map<string, number>()
  for (const step of steps) {
    const key = keyOf(step)
    if (key == null) {
      // a step without a key may depend on what came before; keep everything up to it
      at.clear()
      out.push(step)
      continue
    }
    const index = at.get(key)
    if (index == null) {
      at.set(key, out.length)
      out.push(step)
    } else out[index] = step
  }
  return out
}
