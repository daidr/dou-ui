import type { SheetBounds } from './address'
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

export type SheetStep =
  /** Writes a cell; `cell` left out empties it. `sheet` is the sheet's index. */
  | { type: 'setCell'; sheet: number; row: number; col: number; cell?: SheetCellInput }
  /** Sets a row's height or a column's width; `size` left out goes back to the default. */
  | { type: 'setSize'; sheet: number; axis: 'row' | 'col'; index: number; size?: number }
  | { type: 'updateSheet'; sheet: number; patch: SheetPatch }
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
 * earlier ones; `doc` is the result.
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

  constructor(readonly before: SheetWorkbook) {
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

  sheet(index: number): SheetData {
    const sheet = this.book.sheets[index]
    if (!sheet) throw new RangeError(`There is no sheet ${index}`)
    return sheet
  }

  getCell(sheet: number, row: number, col: number): SheetCellInput {
    return this.sheet(sheet).cells[row]?.[col] ?? undefined
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
  setCell(sheet: number, row: number, col: number, cell: SheetCellInput) {
    return this.step({ type: 'setCell', sheet, row, col, cell })
  }

  /** Changes some of a cell's fields and keeps the rest. */
  updateCell(sheet: number, row: number, col: number, patch: Patch<SheetCell>) {
    const cell = { ...cellOf(this.getCell(sheet, row, col)), ...patch }
    return this.setCell(sheet, row, col, compactCell(cell))
  }

  /** Writes a cell's value and keeps its style and format. */
  setValue(sheet: number, row: number, col: number, value: SheetValue | undefined) {
    return this.updateCell(sheet, row, col, { value: value ?? undefined })
  }

  /** Empties the values in a range, keeping styles and formats. */
  clearValues(sheet: number, bounds: SheetBounds) {
    const { cells } = this.sheet(sheet)
    const last = Math.min(bounds.bottom, cells.length - 1)
    for (let row = bounds.top; row <= last; row++) {
      const line = cells[row]
      if (!line) continue
      const end = Math.min(bounds.right, line.length - 1)
      for (let col = bounds.left; col <= end; col++) {
        const cell = line[col]
        if (cell != null && cell !== '' && (typeof cell !== 'object' || cell.value != null))
          this.setValue(sheet, row, col, undefined)
      }
    }
    return this
  }

  setSize(sheet: number, axis: 'row' | 'col', index: number, size: number | undefined) {
    return this.step({ type: 'setSize', sheet, axis, index, size })
  }

  updateSheet(sheet: number, patch: SheetPatch) {
    return this.step({ type: 'updateSheet', sheet, patch })
  }

  setStyle(name: string, style: SheetStyle | undefined) {
    return this.step({ type: 'setStyle', name, style })
  }

  /** Applies a step, returning the step that undoes it, or `null` when nothing changes. */
  private apply(step: SheetStep): SheetStep | null {
    switch (step.type) {
      case 'setCell': {
        const { row, col } = step
        const cell = step.cell ?? undefined
        const old = this.getCell(step.sheet, row, col)
        if (old === cell || (old == null && cell == null)) return null
        const line = this.row(step.sheet, row)
        line[col] = cell
        return { type: 'setCell', sheet: step.sheet, row, col, cell: old }
      }
      case 'setSize': {
        const key = step.axis === 'row' ? 'rowSizes' : 'colSizes'
        const sizes = this.sheet(step.sheet)[key]
        const old = sizes?.[step.index]
        if (old === step.size) return null
        const next = { ...sizes }
        if (step.size == null) delete next[step.index]
        else next[step.index] = step.size
        this.ownSheet(step.sheet)[key] = next
        return { ...step, size: old }
      }
      case 'updateSheet': {
        const sheet = this.sheet(step.sheet)
        const old: Record<string, unknown> = {}
        let changed = false
        for (const key of Object.keys(step.patch) as (keyof SheetPatch)[]) {
          old[key] = sheet[key]
          if (sheet[key] !== step.patch[key]) changed = true
        }
        if (!changed) return null
        const own = this.ownSheet(step.sheet) as unknown as Record<string, unknown>
        for (const [key, value] of Object.entries(step.patch)) {
          if (value === undefined) delete own[key]
          else own[key] = value
        }
        return { type: 'updateSheet', sheet: step.sheet, patch: old as SheetPatch }
      }
      case 'setStyle': {
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
      const sheet = this.sheet(index)
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
