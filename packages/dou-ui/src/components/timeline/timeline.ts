import type { Tone } from '../../utils/types'

export type TimelineItemTone = Tone

export interface TimelineProps {
  /** Show the newest item first: the line is drawn from the bottom up. */
  reverse?: boolean
}

export interface TimelineSlots {
  /** The items, `DouTimelineItem`s. */
  default?: () => unknown
}

export interface TimelineItemProps {
  /** When it happened, shown above the content. */
  time?: string
  /** The headline. The default slot holds the details. */
  title?: string
  /** Colors the dot only. */
  tone?: TimelineItemTone
  /** Still under way: a hollow dot, and a dashed line leading to it. */
  pending?: boolean
}

export interface TimelineItemSlots {
  default?: () => unknown
  /** Replaces the dot, e.g. with an icon. */
  dot?: () => unknown
  /** Replaces the time. */
  time?: () => unknown
  /** Replaces the title. */
  title?: () => unknown
}
