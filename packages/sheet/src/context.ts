import { inject, type ComputedRef, type InjectionKey, type Ref } from 'vue'
import type { SheetPoint } from './core/address'
import type { SheetResolvedType } from './core/cell-type'
import type { SheetData, SheetValue, SheetWorkbook } from './core/model'
import type { SheetSelection } from './core/selection'
import type { SheetMessages } from './locale'
import type { SheetExpose } from './types'

/** A box in the grid, in px from its top left corner, as drawn now (after scrolling). */
export interface SheetRect {
  x: number
  y: number
  width: number
  height: number
}

/** The surrounding sheet, as `useSheet()` and extensions see it. */
export interface SheetContext {
  /** The workbook, as of the last change. */
  doc: Readonly<Ref<SheetWorkbook>>
  /** The index of the sheet shown. */
  sheetIndex: ComputedRef<number>
  /** The sheet shown. */
  sheet: ComputedRef<SheetData>
  selection: Readonly<Ref<SheetSelection>>
  /** The cell the keyboard is on. */
  active: ComputedRef<SheetPoint>
  readonly: ComputedRef<boolean>
  messages: ComputedRef<SheetMessages>
  /**
   * Calls `callback` for each selected cell of the sheet shown, once each,
   * row by row; a merged cell counts once, at its top left cell.
   */
  forEachSelected: (callback: (point: SheetPoint) => void) => void
  /** The value in a cell of the sheet shown. */
  value: (point: SheetPoint) => SheetValue
  /** A cell's type and its settings, or `undefined` for a plain cell. */
  cellType: (point: SheetPoint) => SheetResolvedType | undefined
  /** Where a cell (or the merged cell it is in) is drawn now; `null` while it is out of view. */
  cellRect: (point: SheetPoint) => SheetRect | null
  transact: SheetExpose['transact']
  undo: SheetExpose['undo']
  redo: SheetExpose['redo']
  canUndo: Readonly<Ref<boolean>>
  canRedo: Readonly<Ref<boolean>>
  select: SheetExpose['select']
  scrollTo: SheetExpose['scrollTo']
  edit: SheetExpose['edit']
  focus: SheetExpose['focus']
  /** Says `text` to screen readers. */
  announce: (text: string) => void
}

export const sheetContextKey: InjectionKey<SheetContext> = Symbol('dou-sheet')

/** The surrounding sheet; for overlays, cell types' components and the grid's slots. */
export function useSheet() {
  const context = inject(sheetContextKey, null)
  if (!context) throw new Error('[dou-ui] useSheet() must be used inside <DouSheet>')
  return context
}
