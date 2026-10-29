export type MarqueeDirection = 'horizontal' | 'vertical'

export interface MarqueeProps {
  direction?: MarqueeDirection
  /** How fast the content moves, in px per second. */
  speed?: number
  /** Move right (or down) instead of left (or up). */
  reverse?: boolean
  /** Space between one copy of the content and the next, in px. */
  gap?: number
  /** Stop while the pointer is over it or focus is inside. */
  pauseOnHover?: boolean
  /** Stop moving. */
  paused?: boolean
  /** Fade the content out toward both ends. */
  fade?: boolean
}

export interface MarqueeSlots {
  /** What scrolls. It is repeated to fill the loop; screen readers read it once. */
  default?: () => unknown
}
