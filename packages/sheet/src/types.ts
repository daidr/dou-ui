import type { SheetCellTarget, SheetRange } from './core/address'
import type { SheetWorkbook } from './core/model'
import type { SheetSelection } from './core/selection'
import type { SheetTransaction, SheetTransactionMeta } from './core/transaction'
import type { SheetMessages } from './locale'

export interface SheetProps {
  /** The workbook. Changes come back through `update:modelValue`. */
  modelValue: SheetWorkbook
  /** What is selected; bind with `v-model:selection`. */
  selection?: SheetSelection
  /** The index of the sheet shown; bind with `v-model:active-sheet`. Defaults to 0. */
  activeSheet?: number
  /** Show the cells without letting anyone change them; selecting still works. */
  readonly?: boolean
  /** The default row height, in px. */
  rowHeight?: number
  /** The default column width, in px. */
  colWidth?: number
  /** Show the column letters and row numbers. */
  headers?: boolean
  /** Draw lines between cells. */
  gridlines?: boolean
  /** How many changes undo can go back. */
  historyDepth?: number
  /** The grid's accessible name. */
  ariaLabel?: string
  /** Texts to change. */
  messages?: Partial<SheetMessages>
}

export interface SheetEmits {
  'update:modelValue': [value: SheetWorkbook]
  'update:selection': [value: SheetSelection]
  'update:activeSheet': [value: number]
  /** Every change, after it is applied: undo, redo and edits alike. */
  transaction: [tr: SheetTransaction]
}

export interface SheetExpose {
  /**
   * Makes a change: `run` adds steps to the transaction, which is applied
   * and recorded for undo as one. Cells without a sheet (`'A5'`) are on
   * the sheet shown. Returns it, or `null` when nothing changed
   * or the grid is read-only.
   */
  transact: (
    run: (tr: SheetTransaction) => void,
    meta?: SheetTransactionMeta,
  ) => SheetTransaction | null
  undo: () => boolean
  redo: () => boolean
  readonly canUndo: boolean
  readonly canRedo: boolean
  /** Selects a range (`'A1:C4'`, `'B2'`, a range or a whole selection) and scrolls it into view. */
  select: (target: string | SheetRange | SheetSelection) => void
  /** Scrolls a cell into view. */
  scrollTo: (cell: SheetCellTarget) => void
  /** Opens the editor on a cell, the active one by default. */
  edit: (cell?: SheetCellTarget) => void
  focus: () => void
}
