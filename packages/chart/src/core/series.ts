import type { Tone } from 'dou-ui'
import type { ChartAccessor, ChartRow, XColumn } from './data'
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
  data?: readonly ChartRow[]
  /** The x of each row of this series' own `data`; defaults to the chart's `x`. */
  x?: ChartAccessor
  /** Any CSS color. Defaults to the next color of the chart palette. */
  color?: string
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
  rows: readonly ChartRow[]
  /** The color as a CSS color the canvas understands. */
  color: string
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
  /** The resolved colors of the chart. */
  colors: ChartColors
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
}
