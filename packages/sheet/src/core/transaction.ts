import {
  boundsOf,
  parseCell,
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
} from './model'

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
