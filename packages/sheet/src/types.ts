import type { Component } from 'vue'
import type { SheetCellTarget, SheetRange } from './core/address'
import type { SheetClip } from './core/clipboard'
import type { SheetCSVWriteOptions } from './core/csv'
import type { SheetCommands } from './core/commands'
import type { SheetExtension } from './core/extension'
import type {
  SheetCSVExportOptions,
  SheetExporter,
  SheetExporterInfo,
  SheetExportScope,
  SheetImportResult,
  SheetImportWarning,
} from './core/file'
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
  /**
   * Show the cells without letting people change them in the grid;
   * selecting still works. Changes made with `transact` still apply.
   */
  readonly?: boolean
  /** The default row height, in px. */
  rowHeight?: number
  /** The default column width, in px. */
  colWidth?: number
  /** Show the column letters and row numbers. */
  headers?: boolean
  /**
   * Show the outline of the groups beside the headers. Without it, groups
   * stay folded or shown as they are, and fold from the menu and the keys.
   */
  outline?: boolean
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
  /**
   * Reads a file dropped on the grid with the importers, putting its
   * first sheet at the cell it was dropped on.
   */
  fileDrop?: boolean
}

/** Where `exportFile` takes the cells from, and what it passes the exporter. */
export interface SheetExportFileOptions<Options = any> {
  /**
   * Every sheet, the sheet shown (or `sheet`), or the selected cells; by
   * default the first the exporter can do.
   */
  scope?: SheetExportScope
  /** The sheet, by index, `id` or name; the one shown by default. */
  sheet?: SheetRef
  /** The cells to write, such as `'A1:F20'`; the selection for `'selection'`. */
  range?: string
  /** Calls the export off; the exporter reads it as `source.signal`. */
  signal?: AbortSignal
  /** Passed on to the exporter, such as CSV's `delimiter`. */
  options?: Options
}

/** `saveFile`'s options: `exportFile`'s, and the file's name. */
export interface SheetSaveFileOptions<Options = any> extends SheetExportFileOptions<Options> {
  /** The file's name, with its extension; the exported sheet's name by default. */
  fileName?: string
}

/**
 * The options of the exporters by name, for `exportFile('csv', { options })`.
 * An extension adds its own by augmenting it:
 *
 * ```ts
 * declare module '@dou-ui/sheet' {
 *   interface SheetExporterOptions { xlsx: XlsxOptions }
 * }
 * ```
 */
export interface SheetExporterOptions {
  csv: SheetCSVExportOptions
  png: SheetImageOptions
  svg: SheetExportOptions
}

/** The options of an exporter named so, or anything for a name no one declared. */
export type SheetExporterOptionsOf<Name> = Name extends keyof SheetExporterOptions
  ? SheetExporterOptions[Name]
  : any

/** An import or export that failed, for the `file-error` event. */
export interface SheetFileErrorEvent {
  action: 'import' | 'export'
  /** The file being read, for an import. */
  file?: Blob
  /** The exporter's name, for an export. */
  exporter?: string
  /** The importer's name, when one took the file. */
  importer?: string
  /** What went wrong; for a file no importer takes, an error saying so. */
  error: unknown
  /** What the grid tells the user, in its language, e.g. “不支持导入“报表.xlsx””. */
  message: string
  defaultPrevented: boolean
  /** Keeps the grid from showing `message`, for a message of your own; screen readers still hear it. */
  preventDefault: () => void
}

/** How `importFile` writes what it read: as new sheets, instead of every sheet, or at the active cell. */
export type SheetImportMode = 'append' | 'replace' | 'insert'

export interface SheetImportFileOptions<Options = any> {
  /** `'append'` by default. */
  mode?: SheetImportMode
  /** The importer, by name; by default the first that takes the file. */
  importer?: string
  /** Calls the import off: the importer reads it, and nothing is written once it is aborted. */
  signal?: AbortSignal
  /** Passed on to the importer. */
  options?: Options
}

/**
 * The `import` event, after a file is read and before it is written in.
 * `book` can be changed, and `preventDefault()` stops it.
 */
export interface SheetImportEvent {
  file: Blob
  /** The name of the importer that read it. */
  importer: string
  mode: SheetImportMode
  book: SheetWorkbook
  /** What the importer couldn't bring over. */
  warnings: SheetImportWarning[]
  defaultPrevented: boolean
  preventDefault: () => void
  /**
   * Writes `book` in with `mode` after `preventDefault()`, e.g. once the
   * user agrees. Returns whether anything was written.
   */
  apply: () => boolean
}

/** An item of the right-click menu. */
export interface SheetMenuItem {
  /** Unique within the menu. */
  key: string
  /**
   * The command it runs (see `commands`): its label, icon, shortcut and
   * whether it can run now come from the command, unless given here.
   */
  command?: string
  /** Needed unless it has a `command`. */
  label?: string
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
  | 'export'
  | 'import'
  | '|'

/**
 * A button of `DouSheetToolbar` added by an extension (its `toolbar`). With
 * a `command`, it takes the label, icon, shortcut, state and action from
 * the command; what is given here wins.
 */
export interface SheetToolbarItem {
  /** Unique within the toolbar; `tools` can name it. */
  key: string
  command?: string
  /** Read out, and shown as the tooltip; shown in place of the icon when there is none. */
  label?: string
  icon?: Component
  run?: () => void
  disabled?: boolean
  /** For a button that turns something on and off: whether it is on. */
  pressed?: boolean
  /** The key that does the same, shown in the tooltip; only a hint. */
  shortcut?: string
  /** Opens a menu of these instead of running anything. */
  children?: SheetMenuItem[]
}

/** A number format offered in the toolbar's menu. */
export interface SheetFormatOption {
  label: string
  /** The format; `undefined` for none. */
  format: string | undefined
  /** A value shown beside it in that format. */
  example?: string | number
}

export interface SheetToolbarProps {
  /**
   * The tools, in order: built-in ones, the `key` of an extension's item,
   * or the name of any command (e.g. `'print'`), shown as a button. By
   * default every built-in tool, then the extensions' items.
   */
  tools?: (SheetToolbarTool | (string & {}))[]
  /** The number formats in the menu, instead of the usual ones. */
  formats?: SheetFormatOption[]
  /**
   * The name the export menu saves files as: a name the exporter's
   * extension is added to, or a function giving the whole name. The
   * exported sheet's name by default.
   */
  fileName?: string | ((exporter: SheetExporterInfo, scope: SheetExportScope) => string)
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
  /** After a file is read, before it is written in: change it, or stop it. */
  import: [event: SheetImportEvent]
  /** An import or export failed; the grid shows a short message too. */
  fileError: [event: SheetFileErrorEvent]
}

export interface SheetExpose {
  /** The commands, built in and added: run them, or read their state, e.g. from a menu bar outside the grid. */
  commands: SheetCommands
  /**
   * Makes a change: `run` adds steps to the transaction, which is applied
   * and recorded for undo as one. Cells without a sheet (`'A5'`) are on
   * the sheet shown. Returns it, or `null` when nothing changed. Works
   * on a `readonly` grid too: that only stops people using the grid.
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
   * The sheet shown (or `sheet`) as CSV: values a spreadsheet can sort and
   * add up by default (what formulas come to, cell types' `plain`), or with
   * `text`, the text the cells show, as their formats and cell types write it.
   */
  toCSV: (options?: SheetCSVWriteOptions & { sheet?: SheetRef }) => string
  /**
   * The sheet shown (or `sheet`) as an SVG document, as the grid draws it,
   * in the current theme.
   */
  exportSVG: (options?: SheetExportOptions) => string
  /** The sheet shown (or `sheet`) as a PNG image. */
  exportPNG: (options?: SheetImageOptions) => Promise<Blob>
  /**
   * Opens the browser's print dialog for the sheet shown (or `sheet`): on
   * A4 pages, in the light theme, with the frozen rows and columns on
   * every page.
   */
  print: (options?: SheetPrintOptions) => void
  /**
   * Writes a file with an exporter (by name, such as `'csv'`, or itself):
   * the workbook, a sheet or the selected cells.
   */
  exportFile: {
    <Name extends string>(
      exporter: Name,
      options?: SheetExportFileOptions<SheetExporterOptionsOf<Name>>,
    ): Promise<Blob>
    <Options>(
      exporter: SheetExporter<Options>,
      options?: SheetExportFileOptions<Options>,
    ): Promise<Blob>
  }
  /**
   * Exports as `exportFile` does and saves the file in the downloads, as the
   * toolbar does. A failure shows a short message over the grid and comes
   * as `file-error`, and the promise rejects.
   */
  saveFile: {
    <Name extends string>(
      exporter: Name,
      options?: SheetSaveFileOptions<SheetExporterOptionsOf<Name>>,
    ): Promise<void>
    <Options>(
      exporter: SheetExporter<Options>,
      options?: SheetSaveFileOptions<Options>,
    ): Promise<void>
  }
  /**
   * Reads a file into the workbook, as one change undo takes back. Returns
   * what was read, or `null` when nothing was written (no importer takes
   * the file, the grid is read-only, the `import` event stopped it, or it
   * was aborted). A failure shows a short message over the grid and comes
   * as `file-error`; an importer's error also rejects the promise.
   */
  importFile: (file: Blob, options?: SheetImportFileOptions) => Promise<SheetImportResult | null>
  /** Opens the editor on a cell, the active one by default. */
  edit: (cell?: SheetCellTarget) => void
  /** Selects a cell, the active one by default, and opens the box to write its note. */
  editNote: (cell?: SheetCellTarget) => void
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

/** Options of `exportSVG` and `exportPNG`. */
export interface SheetExportOptions {
  /** The sheet drawn, by index, `id` or name; the one shown by default. */
  sheet?: SheetRef
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

/** Options of `exportPNG`. */
export interface SheetImageOptions extends SheetExportOptions {
  /** Image pixels per CSS pixel. Defaults to `2`; less for a sheet too big for that. */
  pixelRatio?: number
}

export interface SheetPrintOptions {
  /** The sheet printed, by index, `id` or name; the one shown by default. */
  sheet?: SheetRef
  /** The cells printed, as for `exportSVG`. */
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
