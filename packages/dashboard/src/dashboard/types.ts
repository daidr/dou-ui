import type { CommentAction, CommentAuthor, CommentThread } from 'dou-ui'
import type { SheetExporterOptionsOf } from '@dou-ui/sheet'
import type { SheetExporter } from '@dou-ui/sheet/core'
import type { DashboardCollaboration } from '../core/collaboration'
import type { DashboardTransaction } from '../core/transaction'
import type { DashboardDocument, DashboardPlace } from '../core/types'
import type {
  DashboardFilterField,
  DashboardFilters,
  DashboardLinkedFilter,
  DashboardSetFilterOptions,
  DashboardSources,
} from '../data/types'
import type { GridCompact } from '../layout/types'
import type { DashboardMessagesOverride } from '../locale'
import type { DashboardWidgetType } from '../widget/define'
import type { DashboardImageOptions } from './export'

/** What a comment thread is about: a widget. */
export interface DashboardCommentAnchor {
  widget: string
}

export interface DashboardProps {
  /** The dashboard, bound with `v-model`; a new document object after every change. */
  modelValue?: DashboardDocument
  /** The kinds of widget it can hold, made with `defineDashboardWidget`. */
  widgets?: DashboardWidgetType<any>[]
  /**
   * Where widgets get their data, by name; a widget names its source in
   * `props.source`. Each source loads once for each set of filters, however
   * many widgets show it. A source replaced by another function (or other
   * options) loads again; define the functions once, not in the template.
   */
  sources?: DashboardSources
  /** The filter values, bound with `v-model:filters`; widgets load their sources with them. */
  filters?: DashboardFilters
  /** Whether widgets can be added, moved, resized, changed and removed. */
  editable?: boolean
  /**
   * How many columns the grid has: one number, or one per breakpoint.
   * Defaults to `{ lg: 12, md: 6, sm: 1 }`.
   */
  columns?: number | Record<string, number>
  /** The narrowest width of the dashboard at which each breakpoint applies, in px. Defaults to `{ lg: 1024, md: 640, sm: 0 }`. */
  breakpoints?: Record<string, number>
  /** The height of a row, in px. Defaults to 80. */
  rowHeight?: number
  /** The space between widgets, in px: one number, or `[across, down]`. Defaults to 16. */
  gap?: number | [number, number]
  /** `'vertical'` (the default) floats widgets up into gaps; `false` leaves them where they are put. */
  compact?: GridCompact
  /** The dashboard's accessible name. */
  label?: string
  /** Overrides of the built-in texts. */
  messages?: DashboardMessagesOverride
  /** Makes the id of a new widget. Defaults to the type and a few random letters. */
  createId?: (type: string) => string
  /**
   * Edit together with others: `collaboration()` from
   * `@dou-ui/dashboard/collaboration`. The document then comes from the
   * shared one, and undo only takes back this person's own changes.
   */
  collaboration?: DashboardCollaboration
  /**
   * The file types a widget's content can be exported as, from the menu in
   * its title bar: exporters of `@dou-ui/sheet`, such as `csvExporter` or
   * `xlsxExporter` from `@dou-ui/sheet-xlsx`. Only widgets that give their
   * content as a workbook (`setWorkbook`) have the menu: the built-in
   * table, pivot table and chart do. Exporters that draw a sheet's grid,
   * such as PNG, are left out.
   */
  exporters?: readonly SheetExporter[]
  /**
   * The comment threads, bound with `v-model:comments`. The widget a thread
   * is about keeps the thread's id in its `comments`. Left out, there are
   * no comments.
   */
  comments?: CommentThread[]
  /** Who is commenting. Without it comments can be read but not written. */
  author?: CommentAuthor
  /** The thread open now, bound with `v-model:activeComment`. */
  activeComment?: string | null
  /** Threads can be started and replied to; also while not `editable`. On by default. */
  commentable?: boolean
}

/** Options of a dashboard's `exportWidget`. */
export interface DashboardExportOptions<Options = any> {
  /** The exporter's own options, such as `{ bom: false }` for CSV. */
  options?: Options
  /** Calls the export off. */
  signal?: AbortSignal
}

/** Options of a dashboard's `saveWidget`: `exportWidget`'s, and the file's name. */
export interface DashboardSaveOptions<Options = any> extends DashboardExportOptions<Options> {
  /** The file's name, with its extension; the widget's title by default. */
  fileName?: string
}

/**
 * A widget's component threw while setting up or drawing its content or
 * settings form; that part shows an error with a retry button instead.
 */
export interface DashboardWidgetErrorEvent {
  /** The widget's id. */
  widget: string
  /** Which part broke: what the widget shows, or its settings form. */
  part: 'content' | 'settings'
  error: unknown
}

/** A widget's export from its menu failed. */
export interface DashboardExportErrorEvent {
  /** The widget's id. */
  widget: string
  /** The exporter's name. */
  exporter: string
  error: unknown
  /** What the dashboard shows over the widget's content, unless `preventDefault()` is called. */
  message: string
  defaultPrevented: boolean
  /** Says the app tells of the failure itself. */
  preventDefault: () => void
}

export interface DashboardEmits {
  'update:modelValue': [doc: DashboardDocument]
  'update:filters': [filters: DashboardFilters]
  /** After every change, with the steps that made it and those that undo it. */
  change: [transaction: DashboardTransaction]
  breakpointChange: [breakpoint: string]
  /** Exporting a widget from its menu or `saveWidget` failed; the widget tells of it unless prevented. */
  exportError: [event: DashboardExportErrorEvent]
  /**
   * A widget's content or settings form threw while it set up or drew; it
   * shows an error in its place, and the error goes no further. To report
   * to error tracking.
   */
  widgetError: [event: DashboardWidgetErrorEvent]
  'update:comments': [threads: CommentThread[]]
  'update:activeComment': [id: string | null]
  /** A change to the comments made here: to send to a server, notify people, keep a log. */
  commentAction: [action: CommentAction]
}

export interface DashboardAddOptions {
  /** Where on the widest breakpoint; defaults to the first spot it fits. */
  at?: Pick<DashboardPlace, 'x' | 'y'>
  title?: string
  /** Merged over the type's `defaultProps`. */
  props?: Record<string, unknown>
  /** Moves focus to the new widget. Defaults to `true`. */
  focus?: boolean
}

export interface DashboardExpose {
  /** A transaction on the document as it is now: add, remove and update widgets, then `dispatch` it. */
  transaction: () => DashboardTransaction
  /** Makes the changes of a transaction, as one undo step (or part of one, by `meta.group`). */
  dispatch: (tr: DashboardTransaction) => void
  undo: () => boolean
  redo: () => boolean
  readonly canUndo: boolean
  readonly canRedo: boolean
  /** Adds a widget of a registered type; returns its id, or `undefined` for an unknown type. */
  addWidget: (type: string, options?: DashboardAddOptions) => string | undefined
  removeWidget: (id: string) => void
  /**
   * Opens the open threads on a widget (the one holding the focus when
   * left out), ready to reply, or starts one there; `false` when there is
   * no such widget, comments are off, or there is nothing to open and
   * comments can't be written.
   */
  comment: (id?: string) => boolean
  /** The widget each thread is about; `null` when it is gone. Not reactive. */
  getCommentAnchors: () => Record<string, DashboardCommentAnchor | null>
  /** Adds a copy of a widget next to it; returns the copy's id. */
  duplicateWidget: (id: string) => string | undefined
  focusWidget: (id: string) => void
  /** Opens the settings drawer of a widget (while editing). */
  openSettings: (id: string) => void
  /** Shows a widget full screen. */
  openFullscreen: (id: string) => void
  /**
   * Starts dragging a new widget of a type in from outside: call it in that
   * element's `pointerdown`. See `DouGridLayout`'s `startDrop`.
   */
  startAdd: (event: PointerEvent, type: string) => void
  /** The registered widget types. */
  readonly types: readonly DashboardWidgetType<any>[]
  /** The breakpoint in use. */
  readonly breakpoint: string
  readonly editable: boolean
  /** The document as it is now. */
  readonly document: DashboardDocument
  /** The filter values in effect. */
  readonly filters: DashboardFilters
  /** The filters set by widgets, e.g. by clicking a chart. */
  readonly linkedFilters: readonly DashboardLinkedFilter[]
  /** Sets a filter for every widget; an empty value (`undefined`, `null`, `''`, `[]`) clears it. */
  setFilter: (key: string, value: unknown, options?: DashboardSetFilterOptions) => void
  clearFilters: () => void
  /** Loads the sources shown again: one by name, or all of them. */
  refresh: (source?: string) => void
  /**
   * The dashboard as a PNG image, every widget drawn (also those far from
   * the view) once their data is in, without menus and buttons.
   */
  exportPNG: (options?: DashboardImageOptions) => Promise<Blob>
  /**
   * A widget's content as a file: the workbook it gives, written by an
   * exporter (its name in `exporters`, or the exporter itself). Waits for
   * the data, and draws the widget first when it is far from the view.
   * Fails with a `SheetFileError` (`code: 'empty'`) for a widget that
   * gives no workbook, such as a chart without its fields.
   */
  exportWidget: {
    <Name extends string>(
      id: string,
      exporter: Name,
      options?: DashboardExportOptions<SheetExporterOptionsOf<Name>>,
    ): Promise<Blob>
    <Options>(
      id: string,
      exporter: SheetExporter<Options>,
      options?: DashboardExportOptions<Options>,
    ): Promise<Blob>
  }
  /**
   * Exports as `exportWidget` does and saves the file in the downloads, as
   * the widget's menu does. A failure shows over the widget and comes as
   * `exportError`, and the promise rejects.
   */
  saveWidget: {
    <Name extends string>(
      id: string,
      exporter: Name,
      options?: DashboardSaveOptions<SheetExporterOptionsOf<Name>>,
    ): Promise<void>
    <Options>(
      id: string,
      exporter: SheetExporter<Options>,
      options?: DashboardSaveOptions<Options>,
    ): Promise<void>
  }
  /** Draws every widget, waits for their data, and opens the print dialog. */
  print: () => Promise<void>
}

export interface DashboardPaletteProps {
  /** The dashboard it adds to (its component instance, from a template ref). */
  for?: DashboardExpose | null
  /** Only these types, in this order; defaults to every registered type. */
  types?: string[]
  /** How the list runs. Defaults to `vertical`. */
  direction?: 'vertical' | 'horizontal'
}

export interface DashboardFilterBarProps {
  /** The dashboard whose filters it sets (its component instance, from a template ref). */
  for?: DashboardExpose | null
  /** The controls, in order. Filters set by widgets show after them, each with a button to clear it. */
  fields?: DashboardFilterField[]
  /** Shows a button clearing every filter while any is set. Defaults to `true`. */
  clearable?: boolean
  /** Replaces texts of the language pack. */
  messages?: DashboardMessagesOverride
}
