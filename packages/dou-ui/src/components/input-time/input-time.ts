import type { Placement } from '../../composables/use-floating'
import type { Size } from '../../utils/types'
import type { TimeFormat, TimeRange, TimeValue } from '../time-picker/time-picker'

export interface InputTimeProps {
  /**
   * `HH:mm` or `HH:mm:ss`, or a pair of them with `range`. Bound with
   * `v-model`; `null` until every part is filled in.
   */
  modelValue?: TimeValue | TimeRange | null
  /** Whether to type seconds. */
  format?: TimeFormat
  /**
   * How the time is shown and typed, e.g. `HH:mm` or `hh:mm A` for a
   * 12-hour clock. Defaults to the locale's. The value is always 24-hour.
   */
  displayFormat?: string
  /** Type a start and an end. */
  range?: boolean
  /** Steps of each part under the arrow keys, and of the columns in the panel. */
  hourStep?: number
  minuteStep?: number
  secondStep?: number
  /** Turn the clock glyph into a button that opens the time columns. */
  picker?: boolean
  size?: Size
  disabled?: boolean
  readonly?: boolean
  /** Mark the value as invalid. Sets `aria-invalid` and paints the edge in the danger tone. */
  invalid?: boolean
  /** Show a button that clears the value. */
  clearable?: boolean
  /** Where the panel opens, flipped when there is no room. */
  placement?: Placement
  /** Where to render the panel; `false` keeps it in place. */
  teleport?: string | HTMLElement | false
}

export interface InputTimeEmits {
  'update:modelValue': [value: TimeValue | TimeRange | null]
  /** The value changed by typing, stepping, picking or clearing. */
  change: [value: TimeValue | TimeRange | null]
}

export interface InputTimeExpose {
  /** Focus the first empty part, or the first part. */
  focus: () => void
  blur: () => void
}
