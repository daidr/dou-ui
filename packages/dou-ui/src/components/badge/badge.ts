import type { Tone } from '../../utils/types'

export type BadgeTone = Tone
export type BadgePlacement = 'top-end' | 'bottom-end'

export interface BadgeProps {
  /** A count or a short text. */
  value?: number | string
  /** Counts above this show as `max+`. */
  max?: number
  /** A dot instead of a count, for "something new". */
  dot?: boolean
  /** Ink by default; hue only when the count means something, e.g. `danger` for errors. */
  tone?: BadgeTone
  /** Show a count of `0`. Hidden by default. */
  showZero?: boolean
  /** Hide the badge, keeping the content. */
  hidden?: boolean
  /** The corner a badge on content sits in. */
  placement?: BadgePlacement
  /**
   * Read by screen readers instead of the bare count, e.g. "3 条未读消息".
   * Without it a dot is not announced at all.
   */
  label?: string
}

export interface BadgeSlots {
  /** The content the badge sits on. Without it the badge stands inline. */
  default?: () => unknown
  /** Replaces the count. */
  content?: () => unknown
}
