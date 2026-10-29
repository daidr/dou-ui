import type { Size } from '../../utils/types'

export interface MentionOption {
  /** Inserted after the prefix, e.g. a user name. */
  value: string
  /** Shown in the list. Defaults to `value`. */
  label?: string
  /** A second, quieter line, e.g. a role. */
  description?: string
  disabled?: boolean
}

export interface MentionProps {
  /** The text, bound with `v-model`. */
  modelValue?: string
  /** What can be mentioned. Filter them yourself on `search` for remote data. */
  options?: MentionOption[]
  /** The characters that start a mention. */
  prefix?: string | string[]
  /** Put after an inserted mention. */
  split?: string
  /** Keep only options matching the typed text. `false` leaves filtering to you. */
  filter?: boolean | ((query: string, option: MentionOption) => boolean)
  /** Show a spinner in the list while options load. */
  loading?: boolean
  size?: Size
  rows?: number
  /** Grow with the content; see Textarea. */
  autosize?: boolean | { minRows?: number; maxRows?: number }
  disabled?: boolean
  readonly?: boolean
  invalid?: boolean
  placeholder?: string
  /** Where to render the list; `false` keeps it in place. */
  teleport?: string | HTMLElement | false
}

export interface MentionEmits {
  'update:modelValue': [value: string]
  /** The text after a prefix changed while a mention is being typed. */
  search: [query: string, prefix: string]
  /** An option was inserted. */
  select: [option: MentionOption, prefix: string]
}

export interface MentionSlots {
  /** Replaces an option in the list. */
  option?: (props: { option: MentionOption; query: string }) => unknown
  /** Shown when nothing matches. */
  empty?: () => unknown
}

export interface MentionExpose {
  focus: () => void
  blur: () => void
}
