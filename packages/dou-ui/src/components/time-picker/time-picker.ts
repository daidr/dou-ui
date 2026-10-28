import type { Placement } from '../../composables/use-floating'
import type { Size } from '../../utils/types'
import type { TimeFormat } from './time'

export type { TimeFormat }
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
  placeholder?: string
  startPlaceholder?: string
  endPlaceholder?: string
  size?: Size
  disabled?: boolean
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
