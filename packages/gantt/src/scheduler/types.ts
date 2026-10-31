import type { GanttCalendar } from '../core/calendar'
import type { GanttTask } from '../core/model'
import type { GanttTransaction, GanttTransactionMeta } from '../core/transaction'
import type { GanttMessagesOverride } from '../locale'
import type { GanttMarker } from '../types'
import type { GanttResource } from './layout'

export interface SchedulerProps {
  /** The rows, in order. Tasks go to the row named by their `resource`. */
  resources: GanttResource[]
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
  ariaLabel?: string
  messages?: GanttMessagesOverride
}

export interface SchedulerRange {
  /** The resource's id; `null` for the row of tasks without one. */
  resource: string | null
  /** As a task would have them: dates for whole days, else date and time. */
  start: string
  end: string
}

export interface SchedulerEmits {
  /** After every change, including undo and redo. */
  transaction: [tr: GanttTransaction]
  taskClick: [task: GanttTask, event: MouseEvent]
  taskDblclick: [task: GanttTask, event: MouseEvent]
  /** A time range was drawn on an empty part of a row; add a task for it if you like. */
  rangeSelect: [range: SchedulerRange]
}

export interface SchedulerSlots {
  /** A task's bar content. */
  bar?: (props: { task: GanttTask }) => unknown
  /** A resource in the list. */
  resource?: (props: { resource: GanttResource }) => unknown
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
