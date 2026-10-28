import type { Size, Tone } from '../../utils/types'

export type TextVariant = 'default' | 'secondary' | 'tertiary'
export type TextTone = Tone
export type TextSize = Size
export type TextWeight = 'regular' | 'medium' | 'bold'

export interface TextProps {
  /** How prominent the text is: body copy, supporting copy, or meta information. */
  variant?: TextVariant
  /** What the text means. Combines freely with `variant`. */
  tone?: TextTone
  /** Defaults to inheriting the surrounding font size. */
  size?: TextSize
  /** Defaults to inheriting the surrounding font weight. */
  weight?: TextWeight
  /** Use the monospace font, for hashes, versions and other machine text. */
  mono?: boolean
  /**
   * Cut overflowing text with an ellipsis. `true` keeps a single line, a
   * number clamps to that many lines.
   */
  truncate?: boolean | number
  /** The element to render. */
  as?: string
}

export interface TextSlots {
  default?: () => unknown
}
