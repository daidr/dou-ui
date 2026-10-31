import type { Tone } from 'dou-ui'
import { crisp, type Painter, type Rect } from './painter'
import type { Scale } from './scale'
import type { ChartValueAxis } from './series'

/*
 * Markers: a line at an x or a value (a target, a date), a band between
 * two of them, or a point. Placed on the screen from the chart's scales,
 * drawn with the painter, with their labels as text over the chart.
 */

/** A marker as the chart reads it: x already as a number on the x scale. */
export interface MarkerInput {
  /** One x, or the two ends of a band of x; `null` when not given. */
  x: [number, number] | number | null
  y: [number, number] | number | null
  /** The value axis `y` is on. */
  axis: ChartValueAxis
  label?: string
  tone: Tone
  solid: boolean
}

export type MarkerShape =
  /** A line down the chart (`vertical`) or across it, at `at`, from `from` to `to`. */
  | { kind: 'line'; vertical: boolean; at: number; from: number; to: number }
  | ({ kind: 'area' } & Rect)
  | { kind: 'point'; x: number; y: number }

export interface MarkerLabel {
  text: string
  left: number
  top: number
  /** Which end of the text `left` is: its start, its middle or its end. */
  align: 'start' | 'middle' | 'end'
}

export interface PlacedMarker {
  shape: MarkerShape
  tone: Tone
  solid: boolean
  label: MarkerLabel | null
}

/** Height of a label's box, as tick labels. */
const LABEL = 16
/** Room between a label and its line or point, and the plot's edge. */
const GAP = 4
/** A point's dot. */
export const MARKER_DOT = 4

interface PlaceOptions {
  plot: Rect
  /** The x scale; with `horizontal`, it runs down the left side. */
  x: Scale
  /** A value axis' scale; `null` when the chart has no such axis. */
  y: (axis: ChartValueAxis) => Scale | null
  horizontal: boolean
  measure: (text: string) => number
}

/** Whether `v` is between `from` and `to`, give or take half a pixel. */
const inside = (v: number, from: number, to: number) => v >= from - 0.5 && v <= to + 0.5

/** A value (or the ends of a stretch) in px. */
const along = (scale: Scale, value: [number, number] | number) =>
  typeof value === 'number'
    ? scale.map(value)
    : ([scale.map(value[0]), scale.map(value[1])] as [number, number])

/** Where each marker is drawn, and its label; markers wholly off the plot are left out. */
export function placeMarkers(markers: MarkerInput[], options: PlaceOptions): PlacedMarker[] {
  const { plot, horizontal, measure } = options
  const right = plot.x + plot.width
  const bottom = plot.y + plot.height
  const out: PlacedMarker[] = []
  // the labels placed so far: the next one goes where it doesn't cover them
  const taken: Array<[number, number, number, number]> = []
  const placeLabel = (places: MarkerLabel[], width: number) => {
    const free = places.find((place) => {
      const [x0, y0, x1, y1] = boxOf(place, width)
      return taken.every(([a0, b0, a1, b1]) => x1 <= a0 || x0 >= a1 || y1 <= b0 || y0 >= b1)
    })
    const label = free ?? places[0]!
    taken.push(boxOf(label, width))
    return label
  }
  for (const marker of markers) {
    const yScale = options.y(marker.axis)
    // along x and along the values, in px; with `horizontal` x runs down
    const xs = marker.x === null ? null : along(options.x, marker.x)
    const ys = marker.y === null || !yScale ? null : along(yScale, marker.y)
    if (xs === null && ys === null) continue
    // in screen terms: left to right (u) and top to bottom (v)
    const u = horizontal ? ys : xs
    const v = horizontal ? xs : ys
    let shape: MarkerShape | null = null
    if (typeof u === 'number' && typeof v === 'number') {
      if (inside(u, plot.x, right) && inside(v, plot.y, bottom))
        shape = { kind: 'point', x: u, y: v }
    } else if (typeof u === 'number' && v === null) {
      if (inside(u, plot.x, right))
        shape = { kind: 'line', vertical: true, at: u, from: plot.y, to: bottom }
    } else if (typeof v === 'number' && u === null) {
      if (inside(v, plot.y, bottom))
        shape = { kind: 'line', vertical: false, at: v, from: plot.x, to: right }
    } else {
      // a band (or a box): the stretches given, the whole plot the other way
      const [u0, u1] = Array.isArray(u) ? [Math.min(...u), Math.max(...u)] : [plot.x, right]
      const [v0, v1] = Array.isArray(v) ? [Math.min(...v), Math.max(...v)] : [plot.y, bottom]
      const x = Math.max(plot.x, u0)
      const y = Math.max(plot.y, v0)
      const width = Math.min(right, u1) - x
      const height = Math.min(bottom, v1) - y
      if (width > 0 && height > 0) shape = { kind: 'area', x, y, width, height }
    }
    if (!shape) continue
    const text = marker.label
    out.push({
      shape,
      tone: marker.tone,
      solid: marker.solid,
      label: text ? placeLabel(placesFor(shape, text, measure(text), plot), measure(text)) : null,
    })
  }
  return out
}

/** Where a marker's label may go, best first: by the line's end, at the band's corner, over the point. */
function placesFor(shape: MarkerShape, text: string, width: number, plot: Rect): MarkerLabel[] {
  const right = plot.x + plot.width
  const bottom = plot.y + plot.height
  /** Further down, one label's height at a time, while in the plot. */
  const down = (first: Omit<MarkerLabel, 'text'>) =>
    [0, 1, 2, 3]
      .map((k) => ({ text, ...first, top: first.top + k * (LABEL + 2) }))
      .filter((place, k) => k === 0 || place.top + LABEL <= bottom)
  if (shape.kind === 'line' && shape.vertical) {
    // at the top, after the line; before it when there's no room after
    const after = shape.at + GAP + width <= right
    return down({
      left: after ? shape.at + GAP : shape.at - GAP,
      top: plot.y,
      align: after ? 'start' : 'end',
    })
  }
  if (shape.kind === 'line') {
    // at the right end, above the line, or under it
    const above = { text, left: right - GAP, top: shape.at - LABEL - 2, align: 'end' } as const
    const under = { ...above, top: shape.at + 2 }
    return above.top >= plot.y - GAP ? [above, under] : [under, above]
  }
  if (shape.kind === 'area') return down({ left: shape.x + GAP, top: shape.y + 2, align: 'start' })
  // over the point, kept in the plot; beside it (a peak: the data is lower there); under it
  const reach = MARKER_DOT + GAP
  const half = width / 2
  const middle = Math.min(Math.max(shape.x, plot.x + half), Math.max(plot.x + half, right - half))
  const over: MarkerLabel = { text, left: middle, top: shape.y - reach - LABEL, align: 'middle' }
  const after: MarkerLabel = {
    text,
    left: shape.x + reach,
    top: shape.y - LABEL / 2,
    align: 'start',
  }
  const before: MarkerLabel = { ...after, left: shape.x - reach, align: 'end' }
  const under: MarkerLabel = { ...over, top: shape.y + reach }
  const sides = shape.x + reach + width <= right ? [after, before] : [before, after]
  return over.top >= plot.y - GAP ? [over, ...sides, under] : [...sides, under, over]
}

/** The box a label takes, with its backdrop. */
function boxOf(label: MarkerLabel, width: number): [number, number, number, number] {
  const start =
    label.align === 'start'
      ? label.left
      : label.left - (label.align === 'middle' ? width / 2 : width)
  return [start - GAP, label.top, start + width + GAP, label.top + LABEL]
}

export interface MarkerColors {
  line: string
  /** A point's dot: the line's color, solid. */
  dot: string
  /** A band. */
  fill: string
  surface: string
}

/** Draws the bands (`under` the series) or the lines and points (over them). */
export function drawMarkers(
  painter: Painter,
  markers: PlacedMarker[],
  colors: (tone: Tone) => MarkerColors,
  dpr: number,
  under: boolean,
): void {
  for (const marker of markers) {
    const { shape } = marker
    if ((shape.kind === 'area') !== under) continue
    const c = colors(marker.tone)
    painter.save()
    painter.beginPath()
    if (shape.kind === 'area') {
      painter.fillStyle = c.fill
      painter.rect(shape.x, shape.y, shape.width, shape.height)
      painter.fill()
    } else if (shape.kind === 'line') {
      const at = crisp(shape.at, dpr)
      if (shape.vertical) {
        painter.moveTo(at, shape.from)
        painter.lineTo(at, shape.to)
      } else {
        painter.moveTo(shape.from, at)
        painter.lineTo(shape.to, at)
      }
      painter.lineWidth = 1
      painter.strokeStyle = c.line
      if (!marker.solid) painter.setLineDash([4, 3])
      painter.stroke()
    } else {
      // a dot ringed with the surface, so it stands off a line under it
      painter.arc(shape.x, shape.y, MARKER_DOT, 0, Math.PI * 2)
      painter.fillStyle = c.dot
      painter.strokeStyle = c.surface
      painter.lineWidth = 2
      painter.stroke()
      painter.fill()
    }
    painter.restore()
  }
}
