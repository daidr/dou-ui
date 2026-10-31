import type { Component } from 'vue'
import type { Size } from '../../utils/types'

export type ListboxValue = string | number | boolean
export type ListboxSize = Size

export interface ListboxOption {
  value: ListboxValue
  /** Shown in the list. Defaults to the value. */
  label?: string
  /** A quieter second line under the label. */
  description?: string
  /** An icon before the label, e.g. one from `@dou-ui/icons`. */
  icon?: Component
  disabled?: boolean
}

/** A labelled group of options. */
export interface ListboxOptionGroup {
  label: string
  options: (ListboxOption | string | number)[]
  /** Disable every option in the group. */
  disabled?: boolean
}

export interface ListboxProps {
  /** The chosen value, or an array of them with `multiple`. Bound with `v-model`. */
  modelValue?: ListboxValue | ListboxValue[] | null
  /** Strings and numbers serve as both value and label. Groups list their options under a label. */
  options: (ListboxOption | ListboxOptionGroup | string | number)[]
  /** Choose any number of options; pressing one toggles it. */
  multiple?: boolean
  /** Show a search box above the list. */
  filterable?: boolean
  size?: ListboxSize
  disabled?: boolean
  /** Show the value without letting it change: the field can still be focused and its text selected. */
  readonly?: boolean
  /** Mark the value as invalid. Sets `aria-invalid` and paints the edge in the danger tone. */
  invalid?: boolean
  /** The most the list grows to before it scrolls; a number is in px. */
  maxHeight?: number | string
  /**
   * With `maxHeight`, render only the options in view. By default this turns
   * on by itself past 100 options; pass `false` for options of differing heights.
   */
  virtual?: boolean
  /** Names a listbox that has no visible label. */
  ariaLabel?: string
}

export interface ListboxEmits {
  'update:modelValue': [value: ListboxValue | ListboxValue[] | null]
  /** The user chose or removed an option. */
  change: [value: ListboxValue | ListboxValue[] | null]
}

export interface ListboxSlots {
  /** Each option's content. */
  option?: (props: { option: ListboxOption; selected: boolean }) => unknown
  /** Shown when no option matches the search, or there are none. */
  empty?: () => unknown
}

export interface ListboxExpose {
  focus: () => void
}
