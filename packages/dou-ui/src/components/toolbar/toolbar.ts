import type { InjectionKey } from 'vue'
import type { Size } from '../../utils/types'

export type ToolbarOrientation = 'horizontal' | 'vertical'

export interface ToolbarProps {
  orientation?: ToolbarOrientation
  /** The size of every control inside that does not set its own. */
  size?: Size
  /** Go from the last control back to the first with the arrow keys, and the other way. */
  loop?: boolean
}

export interface ToolbarSlots {
  /** Buttons, toggles, toggle groups, selects and `DouToolbarSeparator`s. */
  default?: () => unknown
}

export interface ToolbarContext {
  orientation: () => ToolbarOrientation
}

export const toolbarKey: InjectionKey<ToolbarContext> = Symbol('DouToolbar')
