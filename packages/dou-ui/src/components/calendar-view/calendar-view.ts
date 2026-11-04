import type { ContextMenuItem } from '../context-menu/context-menu'
import type { Tone } from '../../utils/types'

export interface CalendarEvent<Data extends Record<string, unknown> = Record<string, unknown>> {
  id: string
  /**
   * `YYYY-MM-DD` for an all-day event, or `YYYY-MM-DD HH:mm` for one at a
   * time; timed events sit on the time axis of the week and day views.
   */
  start: string
  /**
   * `YYYY-MM-DD` for the last day of an all-day event, or `YYYY-MM-DD HH:mm`
   * for the moment a timed one ends. Defaults to the same day, or an hour
   * after a timed `start`.
   */
  end?: string
  title: string
  tone?: Tone
  /** Can't be dragged, resized or removed, also when the calendar is `editable`. */
  locked?: boolean
  /** Your own fields, e.g. a place or who attends. */
  data?: Data
}

/**
 * A change about to be made, checked by `canMove`: an event dragged to a
 * new time, its end dragged, or a new stretch of time drawn on the calendar
 * (`event` is `null`). `start` is what would be written; `end` is always
 * given, also for an event that leaves its own out.
 */
export interface CalendarMove {
  kind: 'move' | 'resize' | 'create'
  event: CalendarEvent | null
  start: string
  end: string
}

/** A change written to `v-model:events`. `event` is the new version, `previous` the one it replaced. */
export type CalendarChange =
  | { kind: 'move' | 'resize'; event: CalendarEvent; previous: CalendarEvent }
  | { kind: 'remove'; event: CalendarEvent }

/**
 * A stretch of time drawn on the calendar, written like an event's `start`
 * and `end`: whole days in the month view and the all-day row, times on the
 * time axis.
 */
export interface CalendarRange {
  start: string
  end: string
}

/**
 * What a context menu was opened on: an event, a day of the month or of the
 * all-day row, or an empty spot on the time axis, rounded down to `snap`.
 */
export type CalendarMenuTarget =
  | { kind: 'event'; event: CalendarEvent }
  | { kind: 'day'; date: string }
  | { kind: 'time'; start: string }

/**
 * A month as a grid of days, a week or a day along a time axis, or the
 * month's events as a list by day.
 */
export type CalendarViewMode = 'month' | 'week' | 'day' | 'agenda'

export interface CalendarViewProps {
  /** The chosen day, bound with `v-model`. */
  modelValue?: string | null
  /** The month shown, `YYYY-MM`, bound with `v-model:month`. Starts at the chosen day or today. */
  month?: string
  /** What is shown, bound with `v-model:view`. */
  view?: CalendarViewMode
  /** Show a switch between these views beside the navigation. */
  views?: CalendarViewMode[]
  /** `0` starts weeks on Sunday, `1` on Monday. Follows the locale when unset. */
  weekStart?: 0 | 1
  /** The hours the time axis covers in the week and day views, e.g. `[8, 20]`. */
  hours?: [number, number]
  /** The time scrolled into view when the week or day view opens, `HH:mm`. */
  scrollTime?: string
  /** Things to show in the days, e.g. a schedule; bound with `v-model:events` when `editable`. */
  events?: CalendarEvent[]
  /**
   * Let events be dragged to another time, their end dragged, removed with
   * the menu or `Delete`, and new stretches of time drawn with `create`.
   */
  editable?: boolean
  /** The minutes a drag on the time axis snaps to. */
  snap?: number
  /**
   * The last check before a change is written or a stretch of time drawn,
   * with the events as they are now. Return `true` to allow it; anything
   * else refuses it, and a string is shown as the reason.
   */
  canMove?: (move: CalendarMove, events: CalendarEvent[]) => boolean | string
  /** Your own menu items, listed before the built-in ones. */
  contextMenu?: (target: CalendarMenuTarget) => ContextMenuItem[]
  /** Show the built-in "Delete event" in an event's menu when `editable`. */
  menu?: boolean
  /** The most events listed in a day before the rest fold into "+N". */
  maxEvents?: number
  /** Days that cannot be chosen. */
  disabledDate?: (date: string) => boolean
  /**
   * The hairline frame and rounded corners around the month grid, the
   * week and day columns and the agenda. Off, they take no border at all,
   * for a card or panel that already has an edge. On by default.
   */
  bordered?: boolean
}

export interface CalendarViewEmits {
  'update:modelValue': [date: string]
  'update:month': [month: string]
  'update:view': [view: CalendarViewMode]
  /** A day was chosen. */
  select: [date: string]
  /** An event was pressed. */
  eventClick: [event: CalendarEvent]
  /** An empty spot on the time axis was pressed: `YYYY-MM-DD HH:mm`, rounded down to `snap`. */
  timeClick: [start: string]
  'update:events': [events: CalendarEvent[]]
  /** An event was moved, resized or removed; `update:events` carries the whole new list. */
  change: [change: CalendarChange]
  /** A stretch of time was drawn: add an event for it, or ask for a title first. */
  create: [range: CalendarRange]
  /**
   * Before an event's menu opens, by right click, a resting finger or the
   * menu key; `nativeEvent.preventDefault()` keeps it closed.
   */
  eventContextmenu: [event: CalendarEvent, nativeEvent: MouseEvent]
  /**
   * The days on screen changed, `YYYY-MM-DD` to `YYYY-MM-DD`; also sent
   * once at the start. Pass them to `expandRepeats`.
   */
  rangeChange: [range: CalendarRange]
}

export interface CalendarDay {
  date: string
  day: number
  /** In the month before or after the one shown. */
  outside: boolean
  today: boolean
  selected: boolean
  disabled: boolean
  events: CalendarEvent[]
}

export interface CalendarViewSlots {
  /** Replaces what is under the day number. */
  cell?: (props: CalendarDay) => unknown
  /** Replaces one event in a day, or on the time axis. */
  event?: (props: { event: CalendarEvent; day: CalendarDay }) => unknown
  /** Beside the month navigation, e.g. a view switch. */
  extra?: () => unknown
}

export interface CalendarViewExpose {
  /** Show the month, week or day that holds `date`. */
  show: (date: string) => void
  focus: () => void
}
