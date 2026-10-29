import type { Tone } from '../../utils/types'

export interface CalendarHeatmapDatum {
  /** The day, `YYYY-MM-DD`. */
  date: string
  value: number
}

export interface CalendarHeatmapProps {
  /** The values by day. Days without an entry count as `0`. */
  data?: CalendarHeatmapDatum[]
  /** The first day shown, `YYYY-MM-DD`. Defaults to a year before `end`. */
  start?: string
  /** The last day shown, `YYYY-MM-DD`. Defaults to today. */
  end?: string
  /** The color the shades are mixed from. */
  tone?: Tone
  /**
   * How many shades above zero. Each covers an equal share of the largest
   * value. Ignored when `thresholds` is set.
   */
  levels?: number
  /**
   * The lowest value of each shade above zero, ascending, e.g. `[1, 5, 10]`
   * for three shades.
   */
  thresholds?: number[]
  /** Your own colors, from the empty day to the darkest shade. Overrides `tone`. */
  colors?: string[]
  /** The first day of the week. Defaults to the locale's `region.weekStart`. */
  weekStart?: 0 | 1
  /** Show the "less … more" legend. */
  legend?: boolean
}

export interface CalendarHeatmapEmits {
  /** A day was clicked, or chosen with `Enter` or `Space`. */
  select: [datum: CalendarHeatmapDatum]
}

export interface CalendarHeatmapSlotProps {
  date: string
  value: number
  /** The shade, `0` for an empty day. */
  level: number
}

export interface CalendarHeatmapSlots {
  /** The text shown while a day is hovered or focused. Also its accessible name by default. */
  tooltip?: (props: CalendarHeatmapSlotProps) => unknown
  /** Replaces the legend. */
  legend?: (props: { colors: string[] }) => unknown
}
