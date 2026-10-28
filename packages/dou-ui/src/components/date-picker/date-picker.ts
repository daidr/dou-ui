import type { Placement } from '../../composables/use-floating'
import type { Size } from '../../utils/types'
import type { DateUnit } from './date'

export type DatePickerSize = Size
/** What is picked: a day, a month or a year. */
export type DatePickerType = DateUnit
/** A single value, or `[start, end]` with `range`. */
export type DateValue = string
export type DateRange = [DateValue, DateValue]
/** `0` is Sunday, `1` Monday. */
export type WeekStart = 0 | 1

export interface CalendarProps {
  /**
   * The chosen value, bound with `v-model`: `YYYY-MM-DD`, `YYYY-MM` or
   * `YYYY` by `type`, or `[start, end]` with `range`.
   */
  modelValue?: DateValue | DateRange | null
  type?: DatePickerType
  /** Pick a start and an end. Only for days. */
  range?: boolean
  /** The earliest value that can be picked, inclusive. */
  min?: DateValue
  /** The latest value that can be picked, inclusive. */
  max?: DateValue
  /** Rule out single days, e.g. weekends. Receives `YYYY-MM-DD`. */
  disabledDate?: (date: string) => boolean
  /** The first day of the week. Defaults to Sunday for English and Monday otherwise. */
  weekStart?: WeekStart
  /** Months shown side by side. Defaults to 2 for a range, 1 otherwise. */
  panels?: 1 | 2
}

export interface CalendarEmits {
  'update:modelValue': [value: DateValue | DateRange | null]
  /** A value was picked: a whole range, once its end is picked. */
  select: [value: DateValue | DateRange]
}

export interface CalendarSlots {
  /** Replaces the number in a day cell. */
  cell?: (props: { date: string; day: number }) => unknown
  /** Under the grid, e.g. shortcuts. */
  footer?: () => unknown
}

export interface CalendarExpose {
  /** Focus the active cell. */
  focus: () => void
  /** Show the month or year containing a value and make it the active cell. */
  show: (value: DateValue) => void
}

export interface DatePickerProps extends CalendarProps {
  /** Shown while empty. Defaults to the locale's. */
  placeholder?: string
  /** Placeholders of the two fields of a range. */
  startPlaceholder?: string
  endPlaceholder?: string
  size?: DatePickerSize
  disabled?: boolean
  /** Mark the value as invalid. Sets `aria-invalid` and paints the edge in the danger tone. */
  invalid?: boolean
  /** Show a button that clears the value. */
  clearable?: boolean
  /** Where the calendar opens, flipped when there is no room. */
  placement?: Placement
  /** Where to render the calendar; `false` keeps it in place. */
  teleport?: string | HTMLElement | false
}

export interface DatePickerEmits extends CalendarEmits {
  /** The user picked, typed or cleared a value. */
  change: [value: DateValue | DateRange | null]
}

export interface DatePickerSlots {
  /** Under the calendar, e.g. shortcuts. */
  footer?: (props: { pick: (value: DateValue | DateRange) => void }) => unknown
}

export interface DatePickerExpose {
  focus: () => void
  blur: () => void
}
