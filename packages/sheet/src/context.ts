import type { SheetFunction } from './formula/functions'
import { inject, type ComputedRef, type InjectionKey, type Ref } from 'vue'
import type { SheetBounds, SheetPoint } from './core/address'
import type { SheetResolvedType } from './core/cell-type'
import type { SheetData, SheetSortOrder, SheetStyle, SheetValue, SheetWorkbook } from './core/model'
import type { SheetResult } from './formula/values'
import type { SheetExporterInfo, SheetImporterInfo } from './core/file'
import type { SheetSelection } from './core/selection'
import type { SheetStylePatch } from './core/transaction'
import type { SheetMessages } from './locale'
import type { SheetExpose, SheetToolbarItem } from './types'

/** A box in the grid, in px from its top left corner, as drawn now (after scrolling). */
export interface SheetRect {
  x: number
  y: number
  width: number
  height: number
}

/** Where a range shows: its part in view, with the edges the view cuts off. */
export interface SheetRangeRect extends SheetRect {
  cut: { top: boolean; right: boolean; bottom: boolean; left: boolean }
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
  /** Whether the grid or its cell editor has the keyboard focus. */
  focused: Readonly<Ref<boolean>>
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
  /**
   * Where the part of a range of the sheet shown that is in view is drawn
   * now, past the frozen rows and columns too; `null` while none of it is.
   */
  rangeRect: (bounds: SheetBounds) => SheetRangeRect | null
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
  exportSVG: SheetExpose['exportSVG']
  exportPNG: SheetExpose['exportPNG']
  print: SheetExpose['print']
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
  /** What the sheet can do by name, built in and added by extensions: run them, or read their state. */
  commands: SheetExpose['commands']
  exportFile: SheetExpose['exportFile']
  saveFile: SheetExpose['saveFile']
  importFile: SheetExpose['importFile']
  /** The exporters, labels in the sheet's language: the built-in ones (CSV, PNG, SVG), then the extensions'. */
  exporters: ComputedRef<SheetExporterInfo[]>
  /** The importers, in the order they are asked: the extensions', then the built-in CSV one. */
  importers: ComputedRef<SheetImporterInfo[]>
  /** What a file picker for the importers accepts, such as `.csv,text/csv`. */
  importAccept: ComputedRef<string>
  /** The items extensions add to the toolbar, in priority order. */
  toolbarItems: ComputedRef<SheetToolbarItem[]>
  /** The cell being edited, for inputs outside the grid such as the formula bar. */
  editor: SheetEditorContext
}

/** How an input outside the grid edits the cell, for `editor.attach`. */
export interface SheetEditInputOptions {
  /**
   * The input shows the text and caret itself, following `editor.text`
   * and `editor.caret`, and reports its own with `input` and `moveCaret`;
   * the sheet doesn't write its value. For an input whose element isn't
   * what holds the text, such as a code editor's.
   */
  managed?: boolean
  /** What the function list and argument hints go under; the input by default. */
  anchor?: HTMLElement
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
  attach: (
    el: HTMLInputElement | HTMLTextAreaElement,
    options?: SheetEditInputOptions,
  ) => () => void
  /** The id of the list of functions and argument hints, for `aria-controls`. */
  helpId: string
  /** The functions formulas can call, built in and added, by name. */
  functions: ComputedRef<readonly SheetFunction[]>
}

export const sheetContextKey: InjectionKey<SheetContext> = Symbol('dou-sheet')

/** Where a range shows: its part in view, with the edges the view cuts off. */
export interface SheetRangeRect extends SheetRect {
  cut: { top: boolean; right: boolean; bottom: boolean; left: boolean }
}

/** The surrounding sheet; for overlays, cell types' components and the grid's slots. */
export function useSheet() {
  const context = inject(sheetContextKey, null)
  if (!context) throw new Error('[dou-ui] useSheet() must be used inside <DouSheet>')
  return context
}
