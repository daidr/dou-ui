import type { Component } from 'vue'
import type { SheetCellTarget, SheetRange } from './core/address'
import type { SheetClip } from './core/clipboard'
import type { SheetCSVWriteOptions } from './core/csv'
import type { SheetExtension } from './core/extension'
import type { SheetValidation, SheetWorkbook } from './core/model'
import type { SheetSelection } from './core/selection'
import type { SheetRef, SheetTransaction, SheetTransactionMeta } from './core/transaction'
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
  /**
   * Changes the right-click menu: gets the items the grid would show and
   * where the menu opened, and returns the items to show. Items can be
   * removed, reordered, or added with a `run` of their own.
   */
  menu?: (items: SheetMenuItem[], context: SheetMenuContext) => SheetMenuItem[]
  /**
   * Extensions: cell types, keys, menu items, overlays and hooks. Create
   * the list once, in `<script setup>`; arrays inside are flattened.
   */
  extensions?: (SheetExtension | SheetExtension[])[]
}

/** An item of the right-click menu. */
export interface SheetMenuItem {
  /** Unique within the menu. */
  key: string
  label: string
  icon?: Component
  /** The shortcut shown beside it, such as `mod+c`; hidden on touch screens. */
  shortcut?: string
  tone?: 'neutral' | 'danger'
  /** A line above it. */
  divided?: boolean
  disabled?: boolean
  /** Items shown in a submenu; an item with them has no `run`. */
  children?: SheetMenuItem[]
  run?: () => void
}

/** Where the menu opened. */
export interface SheetMenuContext {
  /**
   * What was pressed: a cell, a column or row header, or the corner. A
   * selection of whole columns or rows counts as their header.
   */
  area: 'cell' | 'col' | 'row' | 'corner'
  /** The selection the menu acts on. */
  selection: SheetSelection
  /** The index of the sheet shown. */
  sheet: number
}

/**
 * The `paste` event, before anything is written. `clip` can be changed or
 * replaced, and `preventDefault()` stops the paste.
 */
export interface SheetPasteEvent {
  clip: SheetClip
  /** Where the clip goes: the first range when one cell fills several. */
  range: SheetRange
  defaultPrevented: boolean
  preventDefault: () => void
}

/**
 * Room above and below the grid, for a toolbar or the sheet tabs. What is
 * put there can use `useSheet()`.
 */
export interface SheetSlots {
  header?: () => unknown
  footer?: () => unknown
}

/**
 * A tool of `DouSheetToolbar`: `|` is a line between groups; `color` and
 * `fill` are the text and fill colors, `align` left / center / right and
 * `valign` top / middle / bottom; `format` is the number format menu and
 * `decimals` the two buttons beside it.
 */
export type SheetToolbarTool =
  | 'undo'
  | 'redo'
  | 'format'
  | 'decimals'
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strike'
  | 'color'
  | 'fill'
  | 'align'
  | 'valign'
  | 'wrap'
  | 'merge'
  | 'freeze'
  | 'sort'
  | 'filter'
  | 'conditional'
  | 'validation'
  | 'clear'
  | '|'

/** A number format offered in the toolbar's menu. */
export interface SheetFormatOption {
  label: string
  /** The format; `undefined` for none. */
  format: string | undefined
  /** A value shown beside it in that format. */
  example?: string | number
}

export interface SheetToolbarProps {
  /** The tools, in order; all of them by default. */
  tools?: SheetToolbarTool[]
  /** The number formats in the menu, instead of the usual ones. */
  formats?: SheetFormatOption[]
}

export interface SheetToolbarSlots {
  /** More controls before the tools, and after them. They can use `useSheet()`. */
  start?: () => unknown
  end?: () => unknown
}

export interface SheetEmits {
  'update:modelValue': [value: SheetWorkbook]
  'update:selection': [value: SheetSelection]
  'update:activeSheet': [value: number]
  /**
   * Every change, after it is applied: undo, redo and edits alike.
   * `tr.meta.action` says what made it.
   */
  transaction: [tr: SheetTransaction]
  /** Before pasting: change what is pasted, or stop it. */
  paste: [event: SheetPasteEvent]
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
  /**
   * Shows a sheet, by index, `id` or name; returns `false` when there is
   * no such sheet.
   */
  showSheet: (sheet: SheetRef) => boolean
  /**
   * The sheet shown (or `sheet`) as CSV, with the text its cells show, as
   * their formats and cell types write it.
   */
  toCSV: (options?: SheetCSVWriteOptions & { sheet?: SheetRef }) => string
  /** The sheet shown as an SVG document, as the grid draws it, in the current theme. */
  toSVG: (options?: SheetImageOptions) => string
  /** The sheet shown as a PNG image. */
  toPNG: (options?: SheetPNGOptions) => Promise<Blob>
  /**
   * Opens the browser's print dialog for the sheet shown: on A4 pages, in
   * the light theme, with the frozen rows and columns on every page.
   */
  print: (options?: SheetPrintOptions) => void
  /** Opens the editor on a cell, the active one by default. */
  edit: (cell?: SheetCellTarget) => void
  focus: () => void
  /** Copies (or cuts) the selection to the system clipboard. */
  copy: () => Promise<void>
  cut: () => Promise<void>
  /**
   * Pastes at the selection: the given cells (e.g. from `parseClip`), or what
   * is on the system clipboard when the browser allows reading it.
   */
  paste: (clip?: SheetClip) => Promise<void>
  /**
   * The cells whose values break a validation rule, row by row: on every
   * sheet, or on `sheet`. Use it to check a workbook before sending it.
   */
  findInvalid: (sheet?: SheetRef) => SheetInvalidCell[]
}

/** Options of `toSVG` and `toPNG`. */
export interface SheetImageOptions {
  /**
   * The cells drawn, such as `'A1:F20'` or `'A:D'`. By default from `A1`
   * to the last row and column with data or a merge.
   */
  range?: string
  /** Draws the column letters and row numbers. */
  headers?: boolean
  /** Draws the grid lines; by default as the grid shows them. */
  gridlines?: boolean
  /** Fills the background; `false` leaves it see-through. Defaults to `true`. */
  background?: boolean
}

export interface SheetPNGOptions extends SheetImageOptions {
  /** Image pixels per CSS pixel. Defaults to `2`; less for a sheet too big for that. */
  pixelRatio?: number
}

export interface SheetPrintOptions {
  /** The cells printed, as for `toSVG`. */
  range?: string
  /** Prints the column letters and row numbers. */
  headers?: boolean
  /** Prints the grid lines; by default as the grid shows them. */
  gridlines?: boolean
  /** A heading on every page. */
  title?: string
  /** By default landscape when the cells are wider than a portrait page. */
  orientation?: 'portrait' | 'landscape'
}

/** A cell whose value breaks a validation rule. */
export interface SheetInvalidCell {
  /** The sheet's name. */
  sheet: string
  /** Where the cell is, such as `'C4'`. */
  cell: string
  rule: SheetValidation
  /** The rule in words: its `message`, or what it asks for. */
  message: string
}
