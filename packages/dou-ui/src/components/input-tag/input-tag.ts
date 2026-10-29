import type { Size } from '../../utils/types'

export type InputTagSize = Size

export interface InputTagProps {
  /** The tags, bound with `v-model`. */
  modelValue?: string[]
  size?: InputTagSize
  disabled?: boolean
  readonly?: boolean
  invalid?: boolean
  placeholder?: string
  /** Show a button that removes every tag. */
  clearable?: boolean
  /** The most tags; the text box hides once there are this many. */
  max?: number
  /**
   * Characters that end a tag as they are typed, and split pasted text.
   * `Enter` always ends one.
   */
  separators?: string[]
  /** Keep a tag that is already in the list. */
  allowDuplicates?: boolean
  /** Turn what was typed into a tag when the field loses focus. */
  addOnBlur?: boolean
  /** Accept or refuse a tag; refused text stays in the box. */
  validate?: (tag: string, tags: string[]) => boolean
}

export interface InputTagEmits {
  'update:modelValue': [value: string[]]
  add: [tag: string]
  remove: [tag: string, index: number]
  clear: []
}

export interface InputTagSlots {
  prefix?: () => unknown
  /** Replaces the label of each tag. */
  tag?: (props: { tag: string; index: number }) => unknown
}

export interface InputTagExpose {
  /** The native `<input>`. */
  input: HTMLInputElement | null
  focus: () => void
  blur: () => void
}
