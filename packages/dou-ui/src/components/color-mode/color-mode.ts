import type { ButtonVariant } from '../button/button'
import type { Size } from '../../utils/types'

/** What the user picked: a fixed mode, or whatever the system prefers. */
export type ColorMode = 'light' | 'dark' | 'system'

/** The mode the page is actually painted in. */
export type ResolvedColorMode = 'light' | 'dark'

export interface UseColorModeOptions {
  /** Where the choice is remembered in `localStorage`; `false` keeps it in memory only. */
  storageKey?: string | false
  /** The mode before the user has picked one. */
  initial?: ColorMode
  /** The element that receives `data-dou-theme`, as an element or a selector. */
  target?: string | HTMLElement
  /** Turn off transitions for the frame the mode changes in, so colors do not fade one by one. */
  disableTransition?: boolean
}

export interface ColorModeButtonProps {
  size?: Size
  variant?: ButtonVariant
}

export interface ColorModeSwitchProps {
  size?: Size
  disabled?: boolean
}

export interface ColorModeSwitchSlots {
  /** The label beside the switch. Without one the switch is still named for screen readers. */
  default?: () => unknown
}

export interface ColorModeSelectProps {
  size?: Size
  disabled?: boolean
}
