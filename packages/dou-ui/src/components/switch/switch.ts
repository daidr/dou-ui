import type { Size } from '../../utils/types'

export type SwitchSize = Size

/** What the switch stands for when on or off; booleans unless `checkedValue` / `uncheckedValue` say otherwise. */
export type SwitchValue = boolean | string | number

export interface SwitchProps<T extends SwitchValue = boolean> {
  /** The current value, bound with `v-model`: `checkedValue` when on, `uncheckedValue` when off. */
  modelValue?: T
  /** The value when on. Defaults to `true`. */
  checkedValue?: T
  /** The value when off. Defaults to `false`. */
  uncheckedValue?: T
  disabled?: boolean
  /** Show the state without letting it change. The switch stays focusable. */
  readonly?: boolean
  /** Mark the switch as invalid: sets `aria-invalid` and paints the edge in the danger tone. */
  invalid?: boolean
  /**
   * Show a spinner in the thumb and ignore presses, e.g. while the new
   * state is being saved. The switch stays focusable.
   */
  loading?: boolean
  /**
   * Called with the value the switch is about to take. Return `false`, or a
   * promise that resolves to `false` or rejects, to keep the current value.
   * While a promise is pending the switch shows its spinner.
   */
  beforeChange?: (next: T) => boolean | Promise<boolean>
  size?: SwitchSize
  /** Names a switch that has no visible label. */
  ariaLabel?: string
}

export interface SwitchEmits<T extends SwitchValue = boolean> {
  'update:modelValue': [value: T]
}

export interface SwitchSlots {
  /** The label. Clicking it toggles the switch. */
  default?: () => unknown
}
