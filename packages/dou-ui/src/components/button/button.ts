import type { Size, Tone } from '../../utils/types'

export type ButtonVariant = 'solid' | 'soft' | 'outline' | 'ghost'
export type ButtonTone = Tone
/**
 * `xs` is a button-only size for secondary actions in dense rows and
 * toolbars; other controls stop at `sm`.
 */
export type ButtonSize = 'xs' | Size

export interface ButtonProps {
  /** How much visual weight the button carries. */
  variant?: ButtonVariant
  /** What the action means. */
  tone?: ButtonTone
  size?: ButtonSize
  disabled?: boolean
  /** Shows a spinner and blocks interaction until the work is done. */
  loading?: boolean
  /** Stretch to fill the width of the container. */
  block?: boolean
  /** The native `type` attribute. Defaults to `button`, never `submit`. */
  nativeType?: 'button' | 'submit' | 'reset'
}

export interface ButtonEmits {
  click: [event: MouseEvent]
}

export interface ButtonSlots {
  default?: () => unknown
  /** Content placed before the label, usually an icon. Hidden while loading. */
  leading?: () => unknown
  /** Content placed after the label, usually an icon. */
  trailing?: () => unknown
}
