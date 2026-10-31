import type { Tone } from 'dou-ui'
import type { ChartAccessor, ChartRow, XColumn } from './data'
import type { Painter, Rect } from './painter'
import type { Scale } from './scale'

/** The y axis a series is measured on. */
export type ChartValueAxis = 'left' | 'right'

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
  /** The y axis to measure on. */
  axis?: ChartValueAxis
}

/** How the chart sees a series once its data is read. */
export interface ResolvedSeries {
  /** Stable for the series' lifetime: its place among all series, hidden or not. */
  index: number
  kind: SeriesKind
  props: ChartSeriesProps & Record<string, unknown>
  name: string
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
}

/** What a series draws with. */
export interface ChartView {
  x: Scale
  y: Scale
  /** The plot area, in CSS px. */
  plot: Rect
  /** Device pixels per CSS px. */
  dpr: number
  /** The resolved colors of the chart. */
  colors: ChartColors
}

export interface ChartColors {
  /** What the chart sits on; rings around dots. */
  surface: string
  grid: string
  baseline: string
}

/** A kind of series: how it widens the axes and how it draws. */
export interface SeriesKind {
  name: string
  /** Whether the value axis must reach 0 (areas and bars grow from it). */
  zero: boolean
  /** Whether series of this kind can stack. */
  stacks: boolean
  draw(painter: Painter, series: ResolvedSeries, view: ChartView): void
}
