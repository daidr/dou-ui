import type { ComputedRef, InjectionKey } from 'vue'
import type { Size, Tone } from '../../utils/types'

export type CheckTagValue = string | number
export type CheckTagSize = Size
export type CheckTagTone = Tone

export interface CheckTagProps {
  /** Selected or not. Bound with `v-model:checked`; inside a group the group decides. */
  checked?: boolean
  /** The value this tag stands for in a group. */
  value?: CheckTagValue
  /** The color of the selected tag. */
  tone?: CheckTagTone
  size?: CheckTagSize
  disabled?: boolean
  /** Fully rounded ends. */
  round?: boolean
}

export interface CheckTagEmits {
  'update:checked': [checked: boolean]
  change: [checked: boolean]
}

export interface CheckTagSlots {
  default?: () => unknown
  /** Content before the label, e.g. an icon or a count. */
  leading?: () => unknown
}

export interface CheckTagOption {
  value: CheckTagValue
  label?: string
  disabled?: boolean
}

export interface CheckTagGroupProps {
  /** The selected value, or the list of them when `multiple`. Bound with `v-model`. */
  modelValue?: CheckTagValue | CheckTagValue[] | null
  /** The tags, as values or option objects. The default slot can hold `DouCheckTag`s instead. */
  options?: (CheckTagValue | CheckTagOption)[]
  /** Let several tags be selected at once. */
  multiple?: boolean
  /** With a single selection, pressing the selected tag clears it. */
  clearable?: boolean
  tone?: CheckTagTone
  size?: CheckTagSize
  round?: boolean
  disabled?: boolean
}

export interface CheckTagGroupEmits {
  'update:modelValue': [value: CheckTagValue | CheckTagValue[] | null]
  change: [value: CheckTagValue | CheckTagValue[] | null]
}

export interface CheckTagGroupSlots {
  default?: () => unknown
  /** Renders each tag from `options`. */
  label?: (props: { option: CheckTagOption; checked: boolean }) => unknown
}

export interface CheckTagGroupContext {
  isChecked: (value: CheckTagValue) => boolean
  toggle: (value: CheckTagValue) => void
  tone: ComputedRef<CheckTagTone | undefined>
  size: ComputedRef<CheckTagSize>
  round: ComputedRef<boolean>
  disabled: ComputedRef<boolean>
}

export const checkTagGroupKey: InjectionKey<CheckTagGroupContext> = Symbol('DouCheckTagGroup')
