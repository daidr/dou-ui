import type { ScrollTarget } from '../../utils/scroll'

export interface BackTopProps {
  /** The scroll area. Defaults to the window. */
  target?: ScrollTarget
  /** Show the button once scrolled this far, in px. */
  visibilityHeight?: number
  /** Distance from the right edge of the viewport, in px. */
  right?: number
  /** Distance from the bottom edge of the viewport, in px. */
  bottom?: number
}

export interface BackTopEmits {
  click: [event: MouseEvent]
}

export interface BackTopSlots {
  /** Replaces the arrow, e.g. with text. */
  default?: () => unknown
}
