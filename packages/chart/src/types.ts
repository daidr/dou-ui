import type { ChartAccessor, ChartRow } from './core/data'
import type { ChartAxisPosition, ChartAxisType, ChartTickValue } from './core/layout'
import type { ChartSeriesProps } from './core/series'
import type { ChartMessagesOverride } from './locale'

export interface ChartProps {
  /** The rows to draw. Replace the array to update it; for large data keep it in a `shallowRef`. */
  data?: readonly ChartRow[]
  /**
   * The x of each row: a key or a function. Numbers make a number axis,
   * dates (`Date`, `'2026-10-31'`, `'2026-10-31 09:30'`) a time axis, and
   * anything else categories. Without it, rows are placed by their index.
   */
  x?: ChartAccessor
  /** Height, a number in px or any CSS length. The width fills the container. */
  height?: number | string
  /** What the chart shows, read out instead of the generated summary. */
  description?: string
  /** Texts to override. */
  messages?: ChartMessagesOverride
}

export interface ChartSlots {
  /** Series, axes and other parts of the chart. */
  default?: () => unknown
}

export interface ChartAxisProps {
  /** Which side: `bottom` is the x axis, `left` and `right` are value axes. */
  position: ChartAxisPosition
  /**
   * How values are spaced. The x axis follows the data by default (numbers,
   * dates or categories); value axes are `linear` unless set to `log`.
   */
  type?: ChartAxisType
  /** Where the axis starts; the data's smallest value (rounded out) by default. */
  min?: number | string | Date
  /** Where the axis ends; the data's largest value (rounded out) by default. */
  max?: number | string | Date
  /** Whether a value axis reaches 0. On by default when a series grows from 0 (areas, bars). */
  zero?: boolean
  /** Round the ends out to tick values. On for value axes, off for the x axis. */
  nice?: boolean
  /** About how many ticks to show, or exactly which values. */
  ticks?: number | ChartTickValue[]
  /** Formats tick labels: numbers, `Date`s on time axes, the category on category axes. */
  format?: (value: any) => string
  /** Lines across the plot at each tick. On for the left axis, off for the others. */
  grid?: boolean
  /** A short title: above a value axis, after the x axis. */
  title?: string
  /** Keep the axis (and its scale) but don't show it. */
  hidden?: boolean
}

export interface ChartLineProps extends ChartSeriesProps {
  /** Curve through the points without swinging past them. Dense data is drawn straight. */
  smooth?: boolean
  /** Dots on the points: always, never, or `auto` when there is room for them. */
  dots?: boolean | 'auto'
  dashed?: boolean
  /** Line width in px. */
  width?: number
  /** Join the line across gaps (`null` values) instead of breaking it. */
  connectNulls?: boolean
  /** Hide the series but keep its color and place. */
  hidden?: boolean
}

export interface ChartAreaProps extends ChartLineProps {
  /** Stack on the series before it with the same `stack` name (`true` is one shared stack). */
  stack?: string | boolean
}
