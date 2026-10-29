import type { Tone } from '../../utils/types'

export interface CalendarEvent {
  /** Defaults to the title and date. */
  key?: string | number
  /** The day it happens on, `YYYY-MM-DD`. */
  date: string
  /** The last day of an event that spans several days. */
  end?: string
  title: string
  tone?: Tone
}

export interface CalendarViewProps {
  /** The chosen day, bound with `v-model`. */
  modelValue?: string | null
  /** The month shown, `YYYY-MM`, bound with `v-model:month`. Starts at the chosen day or today. */
  month?: string
  /** `0` starts weeks on Sunday, `1` on Monday. Follows the locale when unset. */
  weekStart?: 0 | 1
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
  /** A day was chosen. */
  select: [date: string]
  /** An event was pressed. */
  eventClick: [event: CalendarEvent]
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
  /** Replaces one event in a day. */
  event?: (props: { event: CalendarEvent; day: CalendarDay }) => unknown
  /** Beside the month navigation, e.g. a view switch. */
  extra?: () => unknown
}

export interface CalendarViewExpose {
  /** Show the month that holds `date`. */
  show: (date: string) => void
  focus: () => void
}
