import type { Size } from '../../utils/types'

export type SwitchSize = Size

export interface SwitchProps {
  /** Whether the switch is on, bound with `v-model`. */
  modelValue?: boolean
  disabled?: boolean
  /**
   * Show a spinner in the thumb and ignore presses, e.g. while the new
   * state is being saved. The switch stays focusable.
   */
  loading?: boolean
  size?: SwitchSize
}

export interface SwitchEmits {
  'update:modelValue': [value: boolean]
}

export interface SwitchSlots {
  /** The label. Clicking it toggles the switch. */
  default?: () => unknown
}
