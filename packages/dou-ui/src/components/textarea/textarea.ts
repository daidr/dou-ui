import type { Size } from '../../utils/types'

export type TextareaSize = Size
export type TextareaResize = 'none' | 'vertical' | 'horizontal' | 'both'

export interface TextareaAutosize {
  /** The least number of rows to show. Defaults to `rows`. */
  minRows?: number
  /** The most rows to grow to before scrolling. Unlimited when omitted. */
  maxRows?: number
}

export interface TextareaProps {
  /** The value, bound with `v-model`. */
  modelValue?: string
  size?: TextareaSize
  /** Visible rows when not growing with the content. */
  rows?: number
  /** Grow with the content, optionally between a least and a most number of rows. */
  autosize?: boolean | TextareaAutosize
  /** Which way the user may drag to resize. Ignored while `autosize` is on. */
  resize?: TextareaResize
  disabled?: boolean
  readonly?: boolean
  /** Mark the value as invalid. Sets `aria-invalid` and paints the edge in the danger tone. */
  invalid?: boolean
  /** Show how many characters are typed, and the limit when `maxlength` is set. */
  showCount?: boolean
}

export interface TextareaEmits {
  'update:modelValue': [value: string]
}

export interface TextareaExpose {
  /** The native `<textarea>`. */
  textarea: HTMLTextAreaElement | null
  focus: () => void
  blur: () => void
  select: () => void
  /** Measure the content again, e.g. after the field became visible. */
  resizeToContent: () => void
}
