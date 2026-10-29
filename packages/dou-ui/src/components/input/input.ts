import type { Size } from '../../utils/types'

export type InputSize = Size

export interface InputProps {
  /** The value, bound with `v-model`. */
  modelValue?: string
  size?: InputSize
  disabled?: boolean
  readonly?: boolean
  /** Mark the value as invalid. Sets `aria-invalid` and paints the edge in the danger tone. */
  invalid?: boolean
  /** Show a button that clears the value while there is something to clear. */
  clearable?: boolean
  /** The native `type`. */
  type?: 'text' | 'password' | 'email' | 'url' | 'tel' | 'search' | 'number'
  /** With `type="password"`, a button that shows and hides the password. */
  showPassword?: boolean
  /** Show how many characters were typed, and the `maxlength` when one is set. */
  showCount?: boolean
}

export interface InputEmits {
  'update:modelValue': [value: string]
  /** The clear button was pressed. */
  clear: []
}

export interface InputSlots {
  /** Content inside the field before the text, usually an icon. */
  prefix?: () => unknown
  /** Content inside the field after the text, e.g. a unit or an icon. */
  suffix?: () => unknown
}

export interface InputExpose {
  /** The native `<input>`. */
  input: HTMLInputElement | null
  focus: () => void
  blur: () => void
  select: () => void
}
