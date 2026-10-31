import type { Tone } from '../../utils/types'

export interface CalendarEvent {
  /** Tells events apart. Defaults to the start and title. */
  id?: string | number
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
}

/** A month as a grid of days, or a week or a day along a time axis. */
export type CalendarViewMode = 'month' | 'week' | 'day'

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
  /** Things to show in the days, e.g. a schedule. */
  events?: CalendarEvent[]
  /** The most events listed in a day before the rest fold into "+N". */
  maxEvents?: number
  /** Days that cannot be chosen. */
  disabledDate?: (date: string) => boolean
}

export interface CalendarViewEmits {
  'update:modelValue': [date: string]
  'update:month': [month: string]
  'update:view': [view: CalendarViewMode]
  /** A day was chosen. */
  select: [date: string]
  /** An event was pressed. */
  eventClick: [event: CalendarEvent]
  /** An empty spot on the time axis was pressed: `YYYY-MM-DD HH:mm`, rounded down to the half hour. */
  timeClick: [start: string]
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
