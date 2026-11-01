import type { Tone } from 'dou-ui'
import type { ChartAccessor, ChartData, XColumn } from './data'
import type { Painter, Rect } from './painter'
import type { Scale } from './scale'

/** The y axis a series is measured on. */
/** The value axis a series is measured on: `y`, or `y2` for a second kind of values. */
export type ChartValueAxis = 'y' | 'y2'

/** What every series accepts. */
export interface ChartSeriesProps {
  /** The value of each row: a key of the row or a function of it. */
  y: ChartAccessor
  /** Shown in the legend and the tooltip. Defaults to `y` when that is a key. */
  name?: string
  /** Rows of this series alone; defaults to the chart's `data`. */
  data?: ChartData
  /** The x of each row of this series' own `data`; defaults to the chart's `x`. */
  x?: ChartAccessor
  /**
   * Any CSS color. Defaults to the next color of the chart palette. Kinds
   * that draw each point on its own (bars, scatter) also take a function of
   * the row giving that point's color: a CSS color or a tone, `undefined`
   * for the series' color. Its results are in `series.colors`.
   */
  color?: string | ((row: any, index: number) => string | undefined)
  /** A tone, for when the color means something (`danger` for errors). */
  tone?: Tone
  /** The value axis to measure on: `y2` is a second one, on the right (on the top when horizontal). */
  axis?: ChartValueAxis
}

/** A series as it is drawn: its data read into columns and its color worked out. */
export interface ChartSeries<P = Record<string, unknown>> {
  /** Stable for the series' lifetime: its place among all series, hidden or not. */
  index: number
  kind: ChartSeriesKind<any>
  props: ChartSeriesProps & P
  name: string
  /** The rows the series reads: its own `data`, or the chart's. */
  rows: ChartData
  /** The color as a CSS color the canvas understands. */
  color: string
  /**
   * Colors of single points or bars, by row, for a series whose `color`
   * is a function (bars, scatter); `undefined` where the row takes `color`.
   */
  colors?: Array<string | undefined> | null
  axis: ChartValueAxis
  x: XColumn
  /** The values as given. */
  y: Float64Array
  /** Where the series is drawn: `y`, or the top of its slice of a stack. */
  top: Float64Array
  /** The bottom of its slice of a stack; `null` when not stacked. */
  base: Float64Array | null
  /**
   * For a stacked series: how far the whole stack reaches at each x, up
   * (positives) and down (negatives). A slice whose `top` is there is the
   * outermost one.
   */
  stackEnds: { up: Float64Array; down: Float64Array } | null
  /** For series that share the room of each x (bars): which part is theirs. */
  slot: { index: number; count: number } | null
  /**
   * What the kind's `prepare` gave back for this data; `undefined` until
   * it has run, so `draw` and `hit` must work without it.
   */
  prepared?: unknown
}

/** What a series draws with. */
export interface ChartView {
  /** The x scale. With `horizontal`, it runs down the left side. */
  x: Scale
  /** The value scale. With `horizontal`, it runs along the bottom. */
  y: Scale
  /** Whether x runs down and values run across: `map` of `x` gives a top, of `y` a left. */
  horizontal: boolean
  /** The room each x value gets along the x axis, in px: a category's width, or the closest two x apart. */
  band: number
  /** Where a value at `x` lands, as `[left, top]` in CSS px, whichever way the chart runs. */
  point(x: number, value: number): [number, number]
  /** The plot area, in CSS px. */
  plot: Rect
  /** Device pixels per CSS px. */
  dpr: number
  /**
   * Drawing into an SVG (an export, the server's image): shapes only, no
   * images of another canvas.
   */
  vector?: boolean
  /** The resolved colors of the chart. */
  colors: ChartColors
  /**
   * For a radar: its center and radius, and how many spokes. `point`
   * then takes a spoke (the category's index) and a value.
   */
  polar?: { cx: number; cy: number; radius: number; count: number }
}

export interface ChartColors {
  /** What the chart sits on; rings around dots, gaps between slices. */
  surface: string
  grid: string
  baseline: string
}

/** A kind of series: how it widens the axes and how it draws. */
export interface ChartSeriesKind<P = Record<string, unknown>> {
  /** What kind of series it is, in class names (`is-bar`): the legend draws its swatch from it. */
  type: string
  /** Whether the value axis must reach 0 (areas and bars grow from it). */
  zero?: boolean
  /**
   * Whether the series places its rows by category on the value axis too
   * (a heatmap): `y` names a category, `value` gives each cell's value.
   * The value axis then lists the categories, the first at the top; `y`
   * holds the values and `top` the categories' places.
   */
  categoryY?: boolean
  /**
   * Whether the series is drawn round a center (a radar): a spoke for each
   * category, values out from the center. It can't share a chart with
   * series drawn on axes.
   */
  polar?: boolean
  /**
   * Whether the series is a funnel: its rows are stages, one bar under
   * another, without axes. It is drawn alone, as a pie is.
   */
  funnel?: boolean
  /** Whether series of this kind can stack (`stack` prop). */
  stackable?: boolean
  /**
   * Whether series of this kind share the room of each x side by side
   * (bars): each gets a `slot`, and the x axis leaves half a band of room
   * at both ends.
   */
  band?: boolean
  /**
   * Room the series needs around each point, in px, for marks larger than
   * a dot (bubbles): the axes are widened so they fit inside the plot.
   */
  inset?(series: Pick<ChartSeries<P>, 'props' | 'rows' | 'x' | 'y'>): number
  draw(painter: Painter, series: ChartSeries<P>, view: ChartView): void
  /**
   * What the tooltip shows by default: every series at the x under the
   * pointer (`axis`, the default), or the one point under it (`item`,
   * for scatters).
   */
  tooltip?: 'axis' | 'item'
  /**
   * The point under `(px, py)` for an `item` tooltip, and the radius of its
   * mark. By default, the nearest point within 12px.
   */
  hit?(series: ChartSeries<P>, view: ChartView, px: number, py: number): ChartHit | null
  /**
   * Work done ahead, once the data has stayed the same a moment and the
   * page is idle, so `hit` (or `draw`) can be quicker: building an index,
   * say. What it gives back is kept as `series.prepared`. Not run for data
   * replaced many times a second (live data).
   */
  prepare?(series: ChartSeries<P>): unknown
  /**
   * Where the series' data labels go (`labels` prop): a point and the side
   * of it the text takes, for each row on screen worth a label. The chart
   * writes the text, and leaves out labels that cover others.
   */
  labels?(series: ChartSeries<P>, view: ChartView): ChartLabelAnchor[]
}

/** Where a data label goes. */
export interface ChartLabelAnchor {
  /** The row's index in the series' rows. */
  index: number
  /** The point the label is beside, in CSS px. */
  at: [number, number]
  /** Which side of `at` the text goes; `center` puts it on `at`, inside `box`. */
  side: 'top' | 'bottom' | 'left' | 'right' | 'center'
  /** For `center`: the shape the text must fit in (a bar), and its color. */
  box?: Rect & { color: string }
  /**
   * The most room the label may take across its side, in px: its width
   * above or below the point, its height beside it. A bar's label stays
   * within the room of its bar.
   */
  room?: number
}

/** A point found under the pointer. */
export interface ChartHit {
  /** The row's index in the series' rows. */
  index: number
  /** The radius of its mark in px, for the ring that shows it. */
  radius: number
}
