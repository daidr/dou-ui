import type { ComputedRef, InjectionKey } from 'vue'
import type { Size } from '../../utils/types'

export type FieldGroupOrientation = 'horizontal' | 'vertical'

export interface FieldGroupProps {
  /** Lay the controls out in a row or a column. */
  orientation?: FieldGroupOrientation
  /** The size of every control inside that does not set its own. */
  size?: Size
  /** Fill the width of the container. */
  block?: boolean
}

export interface FieldGroupSlots {
  /** Buttons, inputs, selects and `DouFieldGroupText`s. */
  default?: () => unknown
}

export interface FieldGroupTextSlots {
  /** Fixed text or an icon, e.g. `https://` or a unit. */
  default?: () => unknown
}

export interface FieldGroupContext {
  size: ComputedRef<Size | undefined>
}

export const fieldGroupKey: InjectionKey<FieldGroupContext> = Symbol('DouFieldGroup')
