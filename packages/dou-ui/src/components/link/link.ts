import type { Tone } from '../../utils/types'

export type LinkTone = Tone
export type LinkUnderline = 'always' | 'hover' | 'none'

export interface LinkProps {
  /**
   * Where the link goes. Without it the link is an action and renders as
   * `<button type="button">`; listen to `click`.
   */
  href?: string
  /** What the link means. */
  tone?: LinkTone
  /** When the underline shows. A resting underline is faint and deepens on hover. */
  underline?: LinkUnderline
  /**
   * Removes the `href` (or disables the button), so the link can neither be
   * followed nor focused.
   */
  disabled?: boolean
  /**
   * Open in a new tab with `rel="noopener noreferrer"` and mark the link
   * with an arrow. Only applies with an `href`.
   */
  external?: boolean
}

export interface LinkEmits {
  click: [event: MouseEvent]
}

export interface LinkSlots {
  default?: () => unknown
  /** Content placed before the label, usually an icon. */
  leading?: () => unknown
  /** Content placed after the label. Replaces the arrow of an external link. */
  trailing?: () => unknown
}
