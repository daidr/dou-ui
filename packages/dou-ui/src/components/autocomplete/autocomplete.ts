import type { Placement } from '../../composables/use-floating'
import type { Size } from '../../utils/types'

export interface AutocompleteOption {
  /** Put into the field when chosen. */
  value: string
  /** Shown in the list. Defaults to the value. */
  label?: string
  /** A second, quieter line of text at the end of the row. */
  description?: string
  disabled?: boolean
}

export type AutocompleteSource = (AutocompleteOption | string)[]

export interface AutocompleteProps {
  /** The text, bound with `v-model`. */
  modelValue?: string
  /** Suggestions that are filtered by the text as it is typed. */
  options?: AutocompleteSource
  /**
   * Fetch suggestions for the text instead. Called after typing pauses
   * for `debounce` ms; answers to older text are dropped.
   */
  fetch?: (query: string) => AutocompleteSource | Promise<AutocompleteSource>
  /** How suggestions from `options` match the text. `false` shows them all. */
  filter?: boolean | ((option: AutocompleteOption, query: string) => boolean)
  /** Delay before `fetch`, in ms. */
  debounce?: number
  /** Suggest only once at least this many characters are typed. */
  minLength?: number
  /** Mark the part of each suggestion that matches the text. */
  highlight?: boolean
  placeholder?: string
  size?: Size
  disabled?: boolean
  invalid?: boolean
  clearable?: boolean
  placement?: Placement
  teleport?: string | HTMLElement | false
  /**
   * Render only the suggestions in view. By default this turns on by itself
   * past 100 suggestions; pass `false` for suggestions of differing heights.
   */
  virtual?: boolean
  /**
   * Let the text run over several lines, the field growing with it up to
   * `maxRows`. `↑` `↓` move the caret while the list is closed, and Enter
   * starts a new line when no suggestion is highlighted. `clearable` and
   * the `prefix` slot do not apply.
   */
  multiline?: boolean | { maxRows?: number }
}

export interface AutocompleteEmits {
  'update:modelValue': [value: string]
  /** A suggestion was chosen. */
  select: [option: AutocompleteOption]
}

export interface AutocompleteSlots {
  /** Content inside the field before the text. */
  prefix?: () => unknown
  /** Each suggestion. */
  option?: (props: { option: AutocompleteOption; query: string }) => unknown
  /** Shown when nothing matches. Without it the list just closes. */
  empty?: () => unknown
}

export interface AutocompleteExpose {
  focus: () => void
  blur: () => void
}
