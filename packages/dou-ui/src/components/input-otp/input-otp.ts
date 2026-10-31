import type { Size } from '../../utils/types'

export type InputOtpSize = Size
/** What each cell takes: digits, letters and digits, or any character. */
export type InputOtpType = 'numeric' | 'alphanumeric' | 'text'

export interface InputOtpProps {
  /** The code, bound with `v-model`. */
  modelValue?: string
  /** The number of cells. */
  length?: number
  type?: InputOtpType
  /** Show dots instead of the characters. */
  mask?: boolean
  /** Put a gap after these cells (counted from 1), e.g. `3` for `123 456`. */
  separator?: number | number[]
  size?: InputOtpSize
  disabled?: boolean
  /** Show the value without letting it change: the field can still be focused and its text selected. */
  readonly?: boolean
  invalid?: boolean
}

export interface InputOtpEmits {
  'update:modelValue': [value: string]
  /** Every cell is filled. */
  complete: [value: string]
}

export interface InputOtpSlots {
  /** Drawn in a gap set with `separator`. */
  separator?: (props: { after: number }) => unknown
}

export interface InputOtpExpose {
  /** The native `<input>` that holds the code. */
  input: HTMLInputElement | null
  focus: () => void
  blur: () => void
}
