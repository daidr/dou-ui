import { inject, type ComputedRef, type InjectionKey, type Ref } from 'vue'
import type { SheetPoint } from './core/address'
import type { SheetResolvedType } from './core/cell-type'
import type { SheetData, SheetSortOrder, SheetStyle, SheetValue, SheetWorkbook } from './core/model'
import type { SheetResult } from './formula/values'
import type { SheetSelection } from './core/selection'
import type { SheetStylePatch } from './core/transaction'
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
  /** The value in a cell of the sheet shown; for a formula, the formula. */
  value: (point: SheetPoint) => SheetValue
  /** What a cell of the sheet shown comes to: its formula's result, or its value. */
  result: (point: SheetPoint) => SheetResult
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
  showSheet: SheetExpose['showSheet']
  toCSV: SheetExpose['toCSV']
  /** How a cell of the sheet shown looks: its style, or `{}`. A merged cell has its top left cell's. */
  styleAt: (point: SheetPoint) => SheetStyle
  /** A cell's number or date format. */
  formatAt: (point: SheetPoint) => string | undefined
  /**
   * Changes how the selected cells look, as `tr.styleCells` does; `null`
   * takes their styles off. Returns whether anything changed.
   */
  styleSelection: (patch: SheetStylePatch | null) => boolean
  /** Sets the format of the selected cells, or changes each with a function, as `tr.formatCells` does. */
  formatSelection: (
    format:
      string | undefined | ((format: string | undefined, value: SheetValue) => string | undefined),
  ) => boolean
  /** Takes the styles and formats off the selected cells. */
  clearFormatting: () => boolean
  /** Whether the selection touches merged cells. */
  merged: ComputedRef<boolean>
  /** Whether the selection can be merged: one range of more than one cell, not one merge already. */
  canMerge: ComputedRef<boolean>
  /** Merges the selection into one cell, telling how many values that cleared. */
  merge: () => void
  /** Splits the merged cells the selection touches. */
  unmerge: () => void
  /**
   * Sorts by the active cell's column: the selected rows, or the filter's
   * rows, or the block of cells around it. Returns whether it sorted.
   */
  sort: (order: SheetSortOrder) => boolean
  /** Whether the sheet shown has a filter. */
  filtered: ComputedRef<boolean>
  /** Puts a filter on the selection (or the block around the active cell), or takes it off. */
  toggleFilter: () => void
  /** Says `text` to screen readers. */
  announce: (text: string) => void
  /** The cell being edited, for inputs outside the grid such as the formula bar. */
  editor: SheetEditorContext
}

/** Editing the active cell from outside the grid, as the formula bar does. */
export interface SheetEditorContext {
  /** The cell being edited and how: `'enter'` began by typing, so the arrows move on (or point, in a formula). */
  cell: ComputedRef<{ sheet: number; row: number; col: number; mode: 'enter' | 'edit' } | null>
  /** The text being edited. */
  text: Readonly<Ref<string>>
  /** Where the caret is in `text`. */
  caret: Readonly<Ref<number>>
  /** The text a cell edits as: its formula, or its value as typed. */
  textAt: (point: SheetPoint) => string
  /** Sets the text being edited, starting an edit of the active cell when none is open. */
  input: (text: string, caret?: number) => boolean
  /** Tells where the input's caret is, after keys or a click moved it. */
  moveCaret: (caret: number) => void
  /** Handles a key the way the cell's editor does (completion, pointing, Enter, Tab, Escape); `true` when it did. */
  key: (event: KeyboardEvent) => boolean
  /** Saves the edit, then moves the way Enter (`'down'`) or Tab (`'right'`) do. */
  commit: (move?: 'up' | 'down' | 'left' | 'right') => void
  /** Drops the edit. */
  cancel: () => void
  /** Lets an input edit the cell: focus moving to it keeps the edit open. Returns a function that undoes it. */
  attach: (el: HTMLInputElement | HTMLTextAreaElement) => () => void
  /** The id of the list of functions and argument hints, for `aria-controls`. */
  helpId: string
}

export const sheetContextKey: InjectionKey<SheetContext> = Symbol('dou-sheet')

/** The surrounding sheet; for overlays, cell types' components and the grid's slots. */
export function useSheet() {
  const context = inject(sheetContextKey, null)
  if (!context) throw new Error('[dou-ui] useSheet() must be used inside <DouSheet>')
  return context
}
