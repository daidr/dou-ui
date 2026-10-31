import type { GanttCalendar } from './core/calendar'
import type { GanttExtension } from './core/extension'
import type { GanttLink, GanttTask } from './core/model'
import type { Tone } from 'dou-ui'
import type { GanttSchedule } from './core/schedule'
import type { GanttScale } from './core/scale'
import type { GanttDocument, GanttTransaction, GanttTransactionMeta } from './core/transaction'
import type { GanttRow } from './core/tree'
import type { GanttMessagesOverride } from './locale'

/** A column of the task table; written like a column of `DouTable`. */
export interface GanttColumn {
  /**
   * Identifies the column. `title`, `start`, `end`, `duration` and
   * `progress` are built in; any other key reads the task's `data`, unless
   * `value` is given.
   */
  key: string
  /** Header text; built-in columns have their own. */
  title?: string
  /** Reads the cell value from a task. */
  value?: (task: GanttTask) => unknown
  /** A number is in px. A column without one takes the room left over. */
  width?: number | string
  minWidth?: number | string
  align?: 'start' | 'center' | 'end'
}

/** A vertical line across the timeline, such as a release day or a freeze. */
export interface GanttMarker {
  /** Where, as `YYYY-MM-DD` (the start of that day) or `YYYY-MM-DD HH:mm`. */
  date: string
  /** Shown in the time header. */
  label?: string
  tone?: Tone
}

/** New dates about to be given to a task, as they would be written. */
export interface GanttMove {
  task: GanttTask
  start: string
  end?: string
}

/** How a bar shows its task's title. */
export type GanttBarLabel = 'auto' | 'inside' | 'outside' | 'none'

export interface GanttProps {
  /** Which days and hours are worked; shades the rest and counts durations. */
  calendar?: GanttCalendar
  /** Columns of the task table. Defaults to title, start and duration. */
  columns?: GanttColumn[]
  /**
   * Show the task table beside the timeline. Below 520px it steps aside and
   * the task titles show on the timeline.
   */
  table?: boolean
  /** Starting width of the task table, in px. */
  tableWidth?: number
  /** Height of a row, in px. */
  rowHeight?: number
  /**
   * Where a bar's title goes: `auto` puts it inside when it fits and
   * beside the bar otherwise.
   */
  barLabel?: GanttBarLabel
  /**
   * The span the timeline covers, as two dates. Leave it out to cover the
   * tasks with room around them; scrolling to either end adds more.
   */
  range?: [string, string]
  /** Mark the current time with a line. */
  today?: boolean
  /** The first day of a week: `0` Sunday, `1` Monday. Defaults to the locale's. */
  weekStart?: 0 | 1
  /**
   * `manual` (the default) changes only what is moved; links are shown and
   * checked, and the ones not kept are drawn dashed. `auto` also pushes
   * the tasks that wait on a moved task later, in the same undo step.
   */
  scheduling?: 'manual' | 'auto'
  /** Highlight the critical path: the tasks with no slack, and the links that drive them. */
  critical?: boolean
  /** Show the plan without changing it: no dragging, no new links, no undo keys. */
  readonly?: boolean
  /**
   * The last check before a link is made, by dragging or by keys. Return `true` to
   * allow it; anything else refuses it, and a string is shown as the reason.
   */
  canLink?: (link: Pick<GanttLink, 'from' | 'to' | 'type'>, doc: GanttDocument) => boolean | string
  /**
   * The last check before new dates are written, by dragging or by keys.
   * Return `true` to allow them; anything else refuses them, and a string
   * is shown as the reason.
   */
  canMove?: (move: GanttMove, doc: GanttDocument) => boolean | string
  /** Vertical marker lines, such as release days. */
  markers?: GanttMarker[]
  /** Columns, rules, keys and layers added to the chart; see `defineGanttExtension`. */
  extensions?: (GanttExtension | GanttExtension[])[]
  /** Accessible name of the chart. */
  ariaLabel?: string
  /** Texts to change; only the ones given are replaced. */
  messages?: GanttMessagesOverride
}

export interface GanttEmits {
  /** Every change to tasks or links, with its steps; sent after the `update:` events. */
  transaction: [tr: GanttTransaction]
  /** A link was drawn by dragging from one bar to another. */
  link: [link: GanttLink]
  taskClick: [task: GanttTask, event: MouseEvent]
  taskDblclick: [task: GanttTask, event: MouseEvent]
  taskContextmenu: [task: GanttTask, event: MouseEvent]
  linkClick: [link: GanttLink, event: MouseEvent]
}

export interface GanttSlots {
  /** A cell of the task table. */
  cell?: (props: { task: GanttTask; row: GanttRow; column: GanttColumn; text: string }) => unknown
  /** The content of a bar, in place of its title. */
  bar?: (props: { task: GanttTask; row: GanttRow }) => unknown
  /** Drawn over the chart, e.g. a panel; it can call `useGantt()`. */
  default?: () => unknown
}

export interface GanttExpose {
  /** Applies changes as one transaction, one undo step. */
  transact: (fn: (tr: GanttTransaction) => void, meta?: GanttTransactionMeta) => GanttTransaction
  undo: () => boolean
  redo: () => boolean
  readonly canUndo: boolean
  readonly canRedo: boolean
  /**
   * Moves tasks so that every link is kept, as one undo step, and returns
   * what moved. Only pushes tasks later, unless `pull` is set.
   */
  schedule: (options?: { pull?: boolean }) => GanttSchedule
  /** Picks the day width that fits all tasks into view and scrolls to the first one. */
  fit: () => void
  /** Scrolls so that a date (or time) is near the left of the timeline. */
  scrollToDate: (date: string) => void
  /** Scrolls a task into view, rows and time. */
  scrollToTask: (id: string) => void
  /** Scrolls so that now is in view. */
  scrollToToday: () => void
  /** Puts the keyboard on a task, scrolls it into view and focuses its bar. */
  focusTask: (id: string) => void
  /** Widens the days by a step, keeping the middle of the view in place. */
  zoomIn: () => void
  zoomOut: () => void
}

export type { GanttScale }
