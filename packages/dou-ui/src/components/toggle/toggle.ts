import type { ComputedRef, InjectionKey } from 'vue'
import type { Size } from '../../utils/types'

export type ToggleValue = string | number
/** `ghost` has no edge until pressed; `outline` always shows one. */
export type ToggleVariant = 'ghost' | 'outline'
export type ToggleGroupType = 'single' | 'multiple'
export type ToggleGroupOrientation = 'horizontal' | 'vertical'

export interface ToggleProps {
  /** Whether it is pressed, bound with `v-model:pressed`. Ignored inside a group. */
  pressed?: boolean
  /** What it stands for inside a `DouToggleGroup`. */
  value?: ToggleValue
  variant?: ToggleVariant
  size?: Size
  disabled?: boolean
}

export interface ToggleEmits {
  'update:pressed': [pressed: boolean]
}

export interface ToggleSlots {
  /** The label, or an icon alone for a square toggle. */
  default?: () => unknown
  /** An icon before the label. */
  leading?: () => unknown
}

export interface ToggleGroupProps {
  /**
   * The pressed toggles' values, bound with `v-model`: one value or
   * `null` with `type="single"`, a list with `type="multiple"`.
   */
  modelValue?: ToggleValue | ToggleValue[] | null
  /** `single` keeps at most one toggle pressed. */
  type?: ToggleGroupType
  variant?: ToggleVariant
  size?: Size
  disabled?: boolean
  /** Which arrow keys move focus between the toggles. */
  orientation?: ToggleGroupOrientation
}

export interface ToggleGroupEmits {
  'update:modelValue': [value: ToggleValue | ToggleValue[] | null]
  /** The user pressed or released a toggle. */
  change: [value: ToggleValue | ToggleValue[] | null]
}

export interface ToggleGroupSlots {
  /** `DouToggle`s with a `value`. */
  default?: () => unknown
}

export interface ToggleGroupContext {
  isPressed: (value: ToggleValue) => boolean
  toggle: (value: ToggleValue) => void
  variant: ComputedRef<ToggleVariant | undefined>
  size: ComputedRef<Size | undefined>
  disabled: ComputedRef<boolean>
}

export const toggleGroupKey: InjectionKey<ToggleGroupContext> = Symbol('DouToggleGroup')
