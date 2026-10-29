import type { Placement } from '../../composables/use-floating'
import type { Size } from '../../utils/types'

/** Objects need `valueKey` to tell them apart. */
export type SelectValue = string | number | boolean | Record<string, any>
export type SelectSize = Size

export interface SelectOption {
  value: SelectValue
  /** Shown in the list and the field. Defaults to the value. */
  label?: string
  disabled?: boolean
}

/** A labelled group of options. */
export interface SelectOptionGroup {
  label: string
  options: (SelectOption | string | number)[]
  /** Disable every option in the group. */
  disabled?: boolean
}

export interface SelectProps {
  /** The chosen value, or an array of them with `multiple`. Bound with `v-model`. */
  modelValue?: SelectValue | SelectValue[] | null
  /** Strings and numbers serve as both value and label. Groups list their options under a label. */
  options: (SelectOption | SelectOptionGroup | string | number)[]
  /** Choose any number of options; they show as tags. */
  multiple?: boolean
  /** Type to narrow the options down. */
  filterable?: boolean
  /** Shown while nothing is chosen. Defaults to the locale's. */
  placeholder?: string
  size?: SelectSize
  disabled?: boolean
  /** Mark the value as invalid. Sets `aria-invalid` and paints the edge in the danger tone. */
  invalid?: boolean
  /** Show a button that clears the choice. */
  clearable?: boolean
  /** Where the list opens, flipped when there is no room. */
  placement?: Placement
  /** Where to render the list; `false` keeps it in place. */
  teleport?: string | HTMLElement | false
  /** Names a select that has no visible label, e.g. the page size of a pagination. */
  ariaLabel?: string
  /**
   * Search somewhere else: typing emits `search` (after `searchDelay`) instead
   * of filtering `options`, which the parent replaces with the results.
   * Implies `filterable`.
   */
  remote?: boolean
  /** Wait this many ms after the last keystroke before emitting `search`. */
  searchDelay?: number
  /** Show a spinner in the list, e.g. while a remote search runs. */
  loading?: boolean
  /** Offer what was typed as a new option when nothing matches it exactly. Implies `filterable`. */
  creatable?: boolean
  /** Render only the options in view, for long lists. */
  virtual?: boolean
  /** With `multiple`, show at most this many tags and fold the rest into a "+N" tag. */
  maxTagCount?: number
  /** With `multiple`, how many options can be chosen at most. */
  multipleLimit?: number
  /** The property that identifies object values, so equal objects match. */
  valueKey?: string
}

export interface SelectEmits {
  'update:modelValue': [value: SelectValue | SelectValue[] | null]
  /** The user chose or removed an option. */
  change: [value: SelectValue | SelectValue[] | null]
  /** The clear button was pressed. */
  clear: []
  /** The search text changed in a `remote` select, and when it opens. */
  search: [query: string]
  /** A new option was created from the search text in a `creatable` select. */
  create: [value: string]
  /** The list opened or closed. */
  visibleChange: [open: boolean]
  /** A tag was removed from a `multiple` select. */
  removeTag: [value: SelectValue]
}

export interface SelectSlots {
  /** Content inside the field before the value, usually an icon. */
  prefix?: () => unknown
  /** Each option in the list. */
  option?: (props: { option: SelectOption; selected: boolean }) => unknown
  /** Shown when no option matches. */
  empty?: () => unknown
  /** Above the options, e.g. a "select all" checkbox. */
  header?: () => unknown
  /** Under the options, e.g. a button that adds one. */
  footer?: () => unknown
  /** Each tag of a `multiple` select. */
  tag?: (props: { option: SelectOption; remove: () => void }) => unknown
  /** The chosen option in the field of a single select. */
  label?: (props: { option: SelectOption }) => unknown
}

export interface SelectExpose {
  focus: () => void
  blur: () => void
}
