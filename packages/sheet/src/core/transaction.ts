import {
  boundsOf,
  parseCell,
  shiftFormula,
  parseRange,
  splitSheet,
  type SheetBounds,
  type SheetPoint,
  type SheetRange,
} from './address'
import {
  cellOf,
  compactCell,
  type SheetCell,
  type SheetCellInput,
  type SheetData,
  type SheetRow,
  type SheetStyle,
  type SheetValue,
  type SheetWorkbook,
  valueOf,
} from './model'
import { continueValues } from './fill'

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

/** A sheet: its index in the workbook, or its `id` or `name`. */
export type SheetRef = number | string

/**
 * A cell: `'B3'`, `'表 2'!B3` for another sheet, or a point with an
 * optional `sheet`. Without a sheet it is on the transaction's sheet.
 */
export type SheetCellAt = string | (SheetPoint & { sheet?: SheetRef })

/** A range, written like a cell: `'A1:C4'`, `'表 2'!B:B`, a range or its bounds. */
export type SheetRangeAt = string | SheetRange | SheetBounds

/** Rows or columns. */
export type SheetAxisName = 'row' | 'col'

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

export interface SheetTransactionMeta {
  /** Keep out of the undo history, e.g. a change from another client. */
  history?: boolean
  /** Consecutive transactions in the same group within a second undo as one. */
  group?: string
  /** Who made the change, passed on to the `transaction` event. */
  origin?: string
}

/**
 * A batch of changes. Steps apply as they are added, so later calls see
 * earlier ones; `doc` is the result. Cells and ranges without a sheet are
 * on `sheet` (in the grid, the one shown).
 */
export class SheetTransaction {
  readonly steps: SheetStep[] = []
  /** The steps that undo this transaction, in the order to apply them. */
  readonly inverse: SheetStep[] = []
  meta: SheetTransactionMeta = {}
  private book: SheetWorkbook
  /** What this transaction has copied, so it copies each thing once. */
  private own = { book: false, sheets: false, styles: false }
  private ownSheets = new Set<number>()
  private ownRows = new Map<number, Set<number>>()

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
      this.inverse.unshift(inverse)
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
   * Formulas are copied with their references moved along. `invert` swaps
   * continuing and repeating, as Ctrl / ⌘ while dragging does; `copy` only
   * repeats, as Ctrl+D does.
   */
  fill(from: SheetRangeAt, to: SheetRangeAt, options: { invert?: boolean; copy?: boolean } = {}) {
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
      const values = options.copy
        ? Array.from({ length: count }, (_, i) => valueOf(sources[i % length]))
        : continueValues(sources.map(valueOf), count, options.invert, !forward)
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

  /** Adds empty rows before `index`. Frozen rows and the row count grow with them. */
  insertRows(index: number, count = 1, sheet?: SheetRef) {
    return this.insertLines('row', index, count, sheet)
  }

  /** Adds empty columns before `index`. Frozen columns and the column count grow with them. */
  insertCols(index: number, count = 1, sheet?: SheetRef) {
    return this.insertLines('col', index, count, sheet)
  }

  /** Removes rows from `index` on, with their cells and heights. */
  deleteRows(index: number, count = 1, sheet?: SheetRef) {
    return this.deleteLines('row', index, count, sheet)
  }

  /** Removes columns from `index` on, with their cells and widths. */
  deleteCols(index: number, count = 1, sheet?: SheetRef) {
    return this.deleteLines('col', index, count, sheet)
  }

  /** Moves rows from `from` to before row `to` (numbered as before the move). */
  moveRows(from: number, count: number, to: number, sheet?: SheetRef) {
    return this.moveLines('row', from, count, to, sheet)
  }

  /** Moves columns from `from` to before column `to` (numbered as before the move). */
  moveCols(from: number, count: number, to: number, sheet?: SheetRef) {
    return this.moveLines('col', from, count, to, sheet)
  }

  private insertLines(axis: SheetAxisName, index: number, count: number, ref?: SheetRef) {
    if (count <= 0) return this
    const at = this.mustIndex(ref)
    const sheet = this.book.sheets[at]!
    this.step({ type: 'insertLines', sheet: this.keyOf(at), axis, index, count })
    return this.updateSheet(
      linesPatch(sheet, axis, (n) => (n > index ? n + count : n), count),
      at,
    )
  }

  private deleteLines(axis: SheetAxisName, index: number, count: number, ref?: SheetRef) {
    if (count <= 0) return this
    const at = this.mustIndex(ref)
    const sheet = this.book.sheets[at]!
    this.step({ type: 'removeLines', sheet: this.keyOf(at), axis, index, count })
    // frozen lines that were removed are no longer frozen
    const left = (n: number) => n - Math.max(0, Math.min(n, index + count) - index)
    return this.updateSheet(linesPatch(sheet, axis, left, -count), at)
  }

  private moveLines(axis: SheetAxisName, from: number, count: number, to: number, ref?: SheetRef) {
    if (count <= 0 || (to >= from && to <= from + count)) return this
    const at = this.mustIndex(ref)
    return this.step({ type: 'moveLines', sheet: this.keyOf(at), axis, from, count, to })
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
    let sheet: string | undefined
    let bounds: SheetBounds
    if (typeof at === 'string') {
      const split = splitSheet(at)
      sheet = split.sheet
      const range = parseRange(split.ref)
      if (!range) throw new RangeError(`"${at}" isn't a range`)
      bounds = boundsOf(range)
    } else bounds = 'start' in at ? boundsOf(at) : at
    return { index: this.mustIndex(sheet), bounds }
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
    const index = this.mustIndex(step.sheet)
    const sheet = this.book.sheets[index]!
    switch (step.type) {
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
      this.ownRows.delete(index)
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
      this.ownRows.delete(index)
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
      this.ownRows.delete(index)
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

  private ownSheet(index: number) {
    const book = this.ownBook()
    if (!this.own.sheets) {
      book.sheets = book.sheets.slice()
      this.own.sheets = true
    }
    if (!this.ownSheets.has(index)) {
      const sheet = book.sheets[index]!
      book.sheets[index] = { ...sheet, cells: sheet.cells.slice() }
      this.ownSheets.add(index)
    }
    return book.sheets[index]!
  }

  /** The row as an array this transaction may change. */
  private row(sheet: number, row: number): SheetRow {
    const own = this.ownSheet(sheet)
    let rows = this.ownRows.get(sheet)
    if (!rows) this.ownRows.set(sheet, (rows = new Set()))
    if (!rows.has(row)) {
      own.cells[row] = own.cells[row]?.slice() ?? []
      rows.add(row)
    }
    return own.cells[row]!
  }
}

/** Where line `i` ends up when `count` lines from `from` move to before `to`. */
function movedIndex(from: number, count: number, to: number) {
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
