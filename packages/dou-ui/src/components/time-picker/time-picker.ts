import type { Placement } from '../../composables/use-floating'
import type { Size } from '../../utils/types'
import type { DisabledTime, TimeFormat } from './time'

export type { DisabledTime, TimeFormat }
export type TimeValue = string
export type TimeRange = [start: TimeValue, end: TimeValue]

export interface TimePickerProps {
  /** `HH:mm` or `HH:mm:ss`, or a pair of them with `range`. Bound with `v-model`. */
  modelValue?: TimeValue | TimeRange | null
  /** Whether to pick seconds. */
  format?: TimeFormat
  /** Pick a start and an end. */
  range?: boolean
  /** Steps of the hour, minute and second columns. */
  hourStep?: number
  minuteStep?: number
  secondStep?: number
  /**
   * Hours, minutes and seconds that cannot be picked, one rule per column,
   * e.g. `{ hour: (h) => h < 9 || h > 18 }`. Ruled-out rows are greyed
   * out and skipped, and typed times that hit one are refused.
   */
  disabledTime?: DisabledTime
  placeholder?: string
  startPlaceholder?: string
  endPlaceholder?: string
  size?: Size
  disabled?: boolean
  /** Show the value without letting it change: the field can still be focused and its text selected. */
  readonly?: boolean
  invalid?: boolean
  clearable?: boolean
  placement?: Placement
  teleport?: string | HTMLElement | false
}

export interface TimePickerEmits {
  'update:modelValue': [value: TimeValue | TimeRange | null]
  change: [value: TimeValue | TimeRange | null]
}

export interface TimePickerExpose {
  focus: () => void
  blur: () => void
}
