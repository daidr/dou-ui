import type { InjectionKey, Ref } from 'vue'
import type { Size } from '../../utils/types'

export type CheckboxSize = Size
export type CheckboxValue = string | number
export type CheckboxGroupDirection = 'horizontal' | 'vertical'

export interface CheckboxProps {
  /** Whether the box is checked, bound with `v-model`. Ignored inside a group. */
  modelValue?: boolean
  /** The value this box contributes to a `DouCheckboxGroup`. */
  value?: CheckboxValue
  /**
   * Show a dash instead of a check, for a box that stands for a partly
   * selected list. Purely visual: clicking still toggles `modelValue`.
   */
  indeterminate?: boolean
  disabled?: boolean
  /** Show the state without letting it change. Inherits from the group and the form. */
  readonly?: boolean
  /** Mark the box as invalid: sets `aria-invalid` and paints the edge in the danger tone. */
  invalid?: boolean
  /** Inherits from the group, otherwise `md`. */
  size?: CheckboxSize
  /** The native `name`. Inherits from the group. */
  name?: string
  /** Names a box that has no visible label, e.g. one selecting a table row. */
  ariaLabel?: string
}

export interface CheckboxEmits {
  'update:modelValue': [value: boolean]
}

export interface CheckboxSlots {
  /** The label. Clicking it toggles the box. */
  default?: () => unknown
}

export interface CheckboxGroupProps {
  /** The values of the checked boxes, bound with `v-model`. */
  modelValue?: CheckboxValue[]
  /** Disable every box in the group. */
  disabled?: boolean
  /** Show the choice without letting it change. */
  readonly?: boolean
  /** Mark the group as invalid: sets `aria-invalid` and paints every edge in the danger tone. */
  invalid?: boolean
  size?: CheckboxSize
  direction?: CheckboxGroupDirection
  /** The native `name` given to every box. */
  name?: string
}

export interface CheckboxGroupEmits {
  'update:modelValue': [value: CheckboxValue[]]
}

export interface CheckboxGroupSlots {
  default?: () => unknown
}

export interface CheckboxGroupContext {
  model: Readonly<Ref<CheckboxValue[]>>
  disabled: Readonly<Ref<boolean>>
  readonly: Readonly<Ref<boolean>>
  invalid: Readonly<Ref<boolean>>
  size: Readonly<Ref<CheckboxSize>>
  name: Readonly<Ref<string | undefined>>
  toggle: (value: CheckboxValue, checked: boolean) => void
}

export const checkboxGroupKey: InjectionKey<CheckboxGroupContext> = Symbol('DouCheckboxGroup')
