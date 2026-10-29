export interface ShimmerProps {
  /** The element to render. */
  as?: string
  /** Run the sweep. Turned off, the text is drawn plainly. */
  active?: boolean
  /** Seconds for one sweep across the text. */
  duration?: number
}

export interface ShimmerSlots {
  /** The text, e.g. "Generating…". */
  default?: () => unknown
}
