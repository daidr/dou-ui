import type { Size } from '../../utils/types'

export type InputNumberSize = Size

export interface InputNumberProps {
  /** The value, bound with `v-model`. `null` while the field is empty. */
  modelValue?: number | null
  min?: number
  max?: number
  /** How much the buttons and arrow keys change the value. */
  step?: number
  /** Decimal places to round to and show. Defaults to the decimals of `step`. */
  precision?: number
  size?: InputNumberSize
  disabled?: boolean
  readonly?: boolean
  /** Mark the value as invalid. Sets `aria-invalid` and paints the edge in the danger tone. */
  invalid?: boolean
  /** Show the step buttons. */
  controls?: boolean
  /** Show a button that empties the field while it has a value. */
  clearable?: boolean
  /**
   * How the value reads while the field is not being edited, e.g. with
   * thousands separators, as money or as a percentage. Options for
   * `Intl.NumberFormat` in the current locale, or a function of the value.
   * While focused the field shows the plain number for editing.
   */
  format?: Intl.NumberFormatOptions | ((value: number) => string)
  placeholder?: string
}

export interface InputNumberEmits {
  'update:modelValue': [value: number | null]
  /** The value was committed: on blur, on Enter, or by a step. */
  change: [value: number | null, oldValue: number | null]
  /** The clear button emptied the field. */
  clear: []
}

export interface InputNumberSlots {
  /** Content inside the field before the number, e.g. a currency sign. */
  prefix?: () => unknown
  /** Content inside the field after the number, e.g. a unit. */
  suffix?: () => unknown
}

export interface InputNumberExpose {
  /** The native `<input>`. */
  input: HTMLInputElement | null
  focus: () => void
  blur: () => void
  /** Step the value up by `step` times the given count. */
  increase: (count?: number) => void
  /** Step the value down by `step` times the given count. */
  decrease: (count?: number) => void
}
