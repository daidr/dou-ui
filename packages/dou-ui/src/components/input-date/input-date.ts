import type { Placement } from '../../composables/use-floating'
import type { Size } from '../../utils/types'
import type { DateRange, DateValue, WeekStart } from '../date-picker/date-picker'
import type { TimeFormat } from '../time-picker/time'

/** What is typed: a day, a day and a time, a month or a year. */
export type InputDateType = 'date' | 'datetime' | 'month' | 'year'

export interface InputDateProps {
  /**
   * The value, bound with `v-model`: `YYYY-MM-DD`, `YYYY-MM-DD HH:mm(:ss)`,
   * `YYYY-MM` or `YYYY` by `type`, or `[start, end]` with `range`. It is
   * `null` until every part is filled in.
   */
  modelValue?: DateValue | DateRange | null
  type?: InputDateType
  /** Whether a `datetime` carries seconds. */
  timeFormat?: TimeFormat
  /**
   * How the value is shown and typed, e.g. `DD.MM.YYYY` or
   * `YYYY[年]MM[月]DD[日]`. Defaults to the locale's. Only changes the
   * display; the value keeps its own format.
   */
  displayFormat?: string
  /** Type a start and an end. */
  range?: boolean
  /** The earliest value allowed, inclusive. */
  min?: DateValue
  /** The latest value allowed, inclusive. */
  max?: DateValue
  /** Rule out single days, e.g. weekends. Receives `YYYY-MM-DD`. */
  disabledDate?: (date: string) => boolean
  /** Steps of the minute and second parts of a `datetime` under the arrow keys. */
  minuteStep?: number
  secondStep?: number
  /** Turn the calendar glyph into a button that opens a calendar. */
  picker?: boolean
  /** The first day of the week in the calendar. */
  weekStart?: WeekStart
  size?: Size
  disabled?: boolean
  readonly?: boolean
  /** Mark the value as invalid. Sets `aria-invalid` and paints the edge in the danger tone. */
  invalid?: boolean
  /** Show a button that clears the value. */
  clearable?: boolean
  /** Where the calendar opens, flipped when there is no room. */
  placement?: Placement
  /** Where to render the calendar; `false` keeps it in place. */
  teleport?: string | HTMLElement | false
}

export interface InputDateEmits {
  'update:modelValue': [value: DateValue | DateRange | null]
  /** The value changed by typing, stepping, picking or clearing. */
  change: [value: DateValue | DateRange | null]
}

export interface InputDateExpose {
  /** Focus the first empty part, or the first part. */
  focus: () => void
  blur: () => void
}
