import type { GanttCalendar } from './core/calendar'
import type { GanttLink, GanttTask } from './core/model'
import type { GanttScale } from './core/scale'
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
  /** Accessible name of the chart. */
  ariaLabel?: string
  /** Texts to change; only the ones given are replaced. */
  messages?: GanttMessagesOverride
}

export interface GanttEmits {
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
}

export interface GanttExpose {
  /** Picks the day width that fits all tasks into view and scrolls to the first one. */
  fit: () => void
  /** Scrolls so that a date (or time) is near the left of the timeline. */
  scrollToDate: (date: string) => void
  /** Scrolls a task into view, rows and time. */
  scrollToTask: (id: string) => void
  /** Widens the days by a step, keeping the middle of the view in place. */
  zoomIn: () => void
  zoomOut: () => void
}

export type { GanttScale }
