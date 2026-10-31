import type { InjectionKey, Ref } from 'vue'
import type { Size } from '../../utils/types'

export type RadioSize = Size
export type RadioValue = string | number | boolean
export type RadioGroupDirection = 'horizontal' | 'vertical'

export interface RadioProps {
  /** The value this option stands for. */
  value: RadioValue
  /** The selected value, bound with `v-model`, when used without a group. */
  modelValue?: RadioValue
  disabled?: boolean
  /** Show the state without letting it change. Inherits from the group and the form. */
  readonly?: boolean
  /** Inherits from the group, otherwise `md`. */
  size?: RadioSize
  /** The native `name`. Inside a group the group's name is used. */
  name?: string
}

export interface RadioEmits {
  'update:modelValue': [value: RadioValue]
}

export interface RadioSlots {
  /** The label. Clicking it selects the option. */
  default?: () => unknown
}

export interface RadioGroupProps {
  /** The selected value, bound with `v-model`. */
  modelValue?: RadioValue
  disabled?: boolean
  /** Show the choice without letting it change. */
  readonly?: boolean
  /** Mark the group as invalid: sets `aria-invalid` and paints every edge in the danger tone. */
  invalid?: boolean
  size?: RadioSize
  direction?: RadioGroupDirection
  /** The native `name` shared by the options. Generated when omitted. */
  name?: string
}

export interface RadioGroupEmits {
  'update:modelValue': [value: RadioValue]
}

export interface RadioGroupSlots {
  default?: () => unknown
}

export interface RadioGroupContext {
  model: Readonly<Ref<RadioValue | undefined>>
  disabled: Readonly<Ref<boolean>>
  readonly: Readonly<Ref<boolean>>
  size: Readonly<Ref<RadioSize>>
  name: Readonly<Ref<string>>
  select: (value: RadioValue) => void
}

export const radioGroupKey: InjectionKey<RadioGroupContext> = Symbol('DouRadioGroup')
