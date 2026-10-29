import type { Tone } from '../../utils/types'

/** A value, a gap (`null`), or a value with a label for the tooltip. */
export type SparklineValue = number | null | { value: number | null; label?: string }

export type SparklineMarker = 'first' | 'last' | 'min' | 'max'

export interface SparklineProps {
  /** The values, left to right. `null`, `NaN` and infinities are gaps. */
  data?: SparklineValue[]
  type?: 'line' | 'area' | 'bar'
  /** Smooth the line without passing above or below any point. */
  smooth?: boolean
  /** Defaults to `neutral`; a tone is for when the color means something. */
  tone?: Tone
  /** Width, a number in px or any CSS length. */
  width?: number | string
  /** Height, a number in px or any CSS length. */
  height?: number | string
  /**
   * The value at the bottom edge. Defaults to the lowest value (and at most
   * `0` for bars). Set `min` and `max` to compare several sparklines on one scale.
   */
  min?: number
  /** The value at the top edge. Defaults to the highest value (and at least `0` for bars). */
  max?: number
  /** Points to mark with a dot. */
  markers?: SparklineMarker[]
  /** Show the value under the pointer or keyboard focus. */
  interactive?: boolean
  /** Formats values for the tooltip and the accessible description. */
  format?: (value: number) => string
}

export interface SparklineSlotProps {
  /** The position in `data`. */
  index: number
  value: number
  label?: string
  /** `value` through `format`. */
  text: string
}

export interface SparklineSlots {
  /** The tooltip's content. */
  tooltip?: (props: SparklineSlotProps) => unknown
}
