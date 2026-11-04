import type { ContextMenuItem } from 'dou-ui'
import type { GanttCalendar } from '../core/calendar'
import type { GanttTask } from '../core/model'
import type { GanttDocument, GanttTransaction, GanttTransactionMeta } from '../core/transaction'
import type { GanttMessagesOverride } from '../locale'
import type { GanttMarker } from '../types'
import type { SchedulerResource } from './layout'

export interface SchedulerProps {
  /** The rows, in order. Tasks go to the row named by their `resource`. */
  resources: SchedulerResource[]
  /** The working calendar: workdays, days off and working hours. */
  calendar?: GanttCalendar
  /** A fixed span for the time axis, `[start, end]` as dates. Without it the axis follows the tasks. */
  range?: [string, string]
  /** Show a line at the current time. */
  today?: boolean
  /** The first day of the week; defaults to the locale's. */
  weekStart?: 0 | 1
  /** Lines at given dates, such as deadlines. */
  markers?: GanttMarker[]
  /** Show the list of resources beside the timeline. */
  table?: boolean
  /** Width of the resource list, in px. */
  tableWidth?: number
  /** Height of a row with one lane, in px. Each extra lane adds 28px. */
  rowHeight?: number
  /** Show how busy each resource is, under its row. */
  load?: boolean
  readonly?: boolean
  /**
   * The last check before a task is moved, resized or given to another
   * resource, by dragging or by keys. Return `true` to allow it; anything
   * else refuses it, and a string is shown as the reason.
   */
  canMove?: (move: SchedulerMove, doc: GanttDocument) => boolean | string
  /** The built-in context menu item: remove. Turn off to keep only `contextMenu`'s items. */
  menu?: boolean
  /** Your own context menu items, shown above the built-in ones; return none to add nothing. */
  contextMenu?: (target: SchedulerMenuTarget) => ContextMenuItem[]
  /**
   * The hairline frame and rounded corners. Off, the scheduler takes no
   * border at all, for a panel or card that already has an edge. On by
   * default.
   */
  bordered?: boolean
  ariaLabel?: string
  messages?: GanttMessagesOverride
}

/** A change of dates or resource about to be made. */
export interface SchedulerMove {
  task: GanttTask
  start: string
  end?: string
  /** The resource it goes to; `undefined` for the unassigned row. */
  resource?: string
}

/**
 * What a context menu was opened on: a task, or an empty part of a row.
 * `time` is the moment under the pointer, in minutes; from the keyboard it
 * is the task's start.
 */
export type SchedulerMenuTarget =
  | { kind: 'task'; task: GanttTask; resource: SchedulerResource | null; time: number }
  | { kind: 'row'; resource: SchedulerResource | null; time: number }

export interface SchedulerRange {
  /** The resource's id; `undefined` for the row of tasks without one. */
  resource?: string
  /** As a task would have them: dates for whole days, else date and time. */
  start: string
  end: string
}

export interface SchedulerEmits {
  /** After every change, including undo and redo. */
  transaction: [tr: GanttTransaction]
  taskClick: [task: GanttTask, event: MouseEvent]
  taskDblclick: [task: GanttTask, event: MouseEvent]
  /** Sent before the menu opens; `event.preventDefault()` keeps it closed. */
  taskContextmenu: [task: GanttTask, event: MouseEvent]
  /** A time range was drawn on an empty part of a row; add a task for it if you like. */
  create: [range: SchedulerRange]
}

export interface SchedulerSlots {
  /** A task's bar content. */
  bar?: (props: { task: GanttTask }) => unknown
  /** A resource in the list. */
  resource?: (props: { resource: SchedulerResource }) => unknown
  default?: () => unknown
}

export interface SchedulerExpose {
  /** Applies changes as one transaction, one undo step. */
  transact(fn: (tr: GanttTransaction) => void, meta?: GanttTransactionMeta): GanttTransaction
  undo(): boolean
  redo(): boolean
  readonly canUndo: boolean
  readonly canRedo: boolean
  /** Zooms so that all tasks fit. */
  fit(): void
  scrollToDate(date: string): void
  scrollToToday(): void
  scrollToTask(id: string): void
  focusTask(id: string): void
  zoomIn(): void
  zoomOut(): void
}
