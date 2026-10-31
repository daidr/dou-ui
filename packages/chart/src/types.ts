import type { ChartAccessor, ChartRow } from './core/data'
import type { ChartAxisRole, ChartAxisType, ChartTickValue } from './core/layout'
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
  /** The chart's accessible name, read out instead of the generated summary. */
  ariaLabel?: string
  /** A legend under the chart. Shown when there is more than one series, or slice of a pie. */
  legend?: boolean
  /**
   * Lay x down the left side and values along the bottom: bars that are
   * easier to read across, with room for long category names. Axes and
   * series keep their meaning (`x`, `y`, `y2`); only where they are drawn changes.
   */
  horizontal?: boolean
  /** Texts to override. */
  messages?: ChartMessagesOverride
}

export interface ChartSlots {
  /** Series, axes and other parts of the chart. */
  default?: () => unknown
  /** Shown instead of the chart when no series has a value. */
  empty?: () => unknown
}

export interface ChartAxisProps {
  /**
   * What the axis measures: `x`, the values (`y`), or a second kind of
   * values (`y2`, for series with `axis="y2"`). x is drawn at the bottom,
   * y on the left and y2 on the right; on a `horizontal` chart, x on the
   * left, y at the bottom and y2 at the top.
   */
  for: ChartAxisRole
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
  /** Lines across the plot at each tick. On for `y` (or `y2` when it is alone), off for the others. */
  grid?: boolean
  /** A short title: at the top for value axes (at the end for `y` on a horizontal chart), at the end of the x axis. */
  title?: string
  /** Keep the axis (and its scale) but don't show it. */
  hidden?: boolean
  /**
   * The room for tick labels, in px, for an axis drawn down the side.
   * Give charts stacked one above another the same value to line up their plots.
   */
  labelWidth?: number
}

export interface ChartLineProps extends ChartSeriesProps {
  /** Curve through the points without swinging past them. Dense data is drawn straight. */
  smooth?: boolean
  /** Dots on the points: always, never, or `auto` when there is room for them. */
  dots?: boolean | 'auto'
  dashed?: boolean
  /** Line width in px. */
  lineWidth?: number
  /** Join the line across gaps (`null` values) instead of breaking it. */
  connectNulls?: boolean
}

export interface ChartAreaProps extends ChartLineProps {
  /** Stack on the series before it with the same `stack` name (`true` is one shared stack). */
  stack?: string | boolean
}

export interface ChartBarProps extends ChartSeriesProps {
  /** Stack on the bars before it with the same `stack` name (`true` is one shared stack). */
  stack?: string | boolean
  /** Corner radius of the bar's end, in px. In a stack, only the outermost bar is rounded. */
  radius?: number
}

export interface ChartScatterProps extends ChartSeriesProps {
  /** The size of each point, a key or a function: makes bubbles whose area grows with it. */
  size?: ChartAccessor
  /** What `size` is, shown in the tooltip; defaults to `size` when that is a key. */
  sizeName?: string
  /** The name of each point (a key or a function), the title of its tooltip; the series' name by default. */
  label?: ChartAccessor
  /** Dot radius in px; with `size`, the radius of the largest bubble. */
  radius?: number
}

export interface ChartPieProps {
  /** The value of each slice: a key of the row or a function of it. Values of 0 or less are left out. */
  value: ChartAccessor
  /** The name of each slice, shown in the legend; defaults to the chart's `x`. */
  label?: ChartAccessor
  /** Rows of this pie alone; defaults to the chart's `data`. */
  data?: readonly ChartRow[]
  /** What the pie shows, read out before its slices. */
  name?: string
  /**
   * The color of each slice, a key or a function: any CSS color, or a tone
   * (`danger`, `neutral`…). Without it, slices take the palette's colors in
   * turn, leaving out the neutral first one, which `neutral` gives to "other".
   */
  color?: ChartAccessor<string | undefined>
  /** The size of the hole, as a part of the radius: `0` is a pie, `0.6` a donut. */
  innerRadius?: number
}

export interface ChartTooltipProps {
  /**
   * What it shows: every series at the x under the pointer (`axis`), or
   * the one point or slice under it (`item`). `item` for scatters and pies,
   * `axis` for the others.
   */
  trigger?: 'axis' | 'item'
  /** A line across the plot at the x under the pointer (a shaded band for bars). On by default. */
  crosshair?: boolean
  /** No tooltip: the chart doesn't follow the pointer and can't be focused. */
  disabled?: boolean
}

/** One line of a tooltip. */
export interface ChartTooltipItem {
  /** The series' or slice's name, or what the value is (`x`) for one point. */
  name: string
  /** The value as the axis shows it. */
  text: string
  /** The value itself; `undefined` for an x that isn't a number. */
  value?: number
  /** The series' or slice's color; `undefined` for a line that isn't one. */
  color?: string
  /** The row the value comes from. */
  row?: ChartRow
}

export interface ChartTooltipSlots {
  /** The tooltip's content. */
  default?: (props: {
    /** The x (axis tooltips), or the series (one point). */
    title?: string
    items: ChartTooltipItem[]
    /** A note under the values: how many slices of a pie are turned off. */
    note?: string
  }) => unknown
}

/** What `select` gives: what the tooltip shows where it was clicked. */
export interface ChartSelectEvent {
  /** The x as given: the category, a `Date` on a time axis, or the number; a slice's label. */
  x: unknown
  title?: string
  /** One per series at the x, or the one point or slice. */
  items: ChartTooltipItem[]
}

export interface ChartPieSlots {
  /** Shown in the hole of a donut: a total, a title. */
  default?: () => unknown
}

/**
 * A stretch of an axis, from one value to another: numbers, `Date`s on a
 * time axis, categories on a category axis (both ends included).
 */
export type ChartInterval = [from: ChartTickValue, to: ChartTickValue]

/** Which axes a part works along: x, the values, or both. */
export type ChartZoomAxis = 'x' | 'y' | 'xy'

export interface ChartZoomProps {
  /** The axes to zoom and pan: x (the default), the values (`y`, with `y2` following), or both. */
  axis?: ChartZoomAxis
  /**
   * Zoom with the wheel alone. By default the wheel scrolls the page, and
   * zooms with Ctrl (⌘ on a Mac) held; pinching on a trackpad zooms either way.
   */
  wheel?: boolean
  /** Turns zooming off and shows the whole chart. */
  disabled?: boolean
}

export interface ChartBrushProps {
  /** Select a stretch of x (the default), of the values (`y`), or a box of both. */
  axis?: ChartZoomAxis
  /** Fade what is outside the selection. On by default. */
  dim?: boolean
  /** Turns selecting off. */
  disabled?: boolean
}

/**
 * What `select` of `DouChartBrush` gives: the stretch selected and the rows
 * in it. When the selection is let go, neither `x` nor `y` and no rows.
 */
export interface ChartBrushEvent {
  /** The stretch of x, unless only values were selected. */
  x?: ChartInterval
  /** The stretch of values (on `y`, or on `y2` when it is alone), when they were selected. */
  y?: ChartInterval
  /** The rows with a point in the selection, each once: by series, then along x. */
  rows: ChartRow[]
  /** The same, by series. */
  series: Array<{ name: string; rows: ChartRow[] }>
}
