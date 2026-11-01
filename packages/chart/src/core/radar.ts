import { tracePoints, type Painter } from './painter'
import type { ChartSeries, ChartSeriesKind, ChartView } from './series'

/*
 * A radar: a spoke for each category, evenly round from 12 o'clock and
 * clockwise, and for each series a closed shape through its values along
 * them, from 0 at the center out to the largest value at the rim. The
 * rings of the grid are polygons, so equal values lie on straight lines.
 */

export interface RadarStyle {
  /** Dots on the corners: `true`, `false`, or (the default) when there are few. */
  dots?: boolean
  /** The width of the outline, in px. */
  lineWidth?: number
}

/** The most spokes a series gets dots on by default: more crowd the rim. */
const DOT_SPOKES = 12

/** The angle of spoke `index` of `count`, clockwise from 12 o'clock. */
export function spokeAngle(index: number, count: number): number {
  return (index / Math.max(1, count)) * Math.PI * 2
}

/** The spoke nearest the angle `angle` (clockwise from 12 o'clock), of `count`. */
export function nearestSpoke(angle: number, count: number): number {
  if (count < 1) return -1
  const step = (Math.PI * 2) / count
  return Math.round(angle / step) % count
}

/** A radar's corners in px, in spoke order, for the rows with a value. */
function corners(series: ChartSeries<RadarStyle>, view: ChartView) {
  const order: number[] = []
  for (let i = 0; i < series.top.length; i++) {
    const x = series.x.values[i]!
    if (x === x && series.top[i] === series.top[i]) order.push(i)
  }
  order.sort((a, b) => series.x.values[a]! - series.x.values[b]!)
  const xs = new Float64Array(order.length)
  const ys = new Float64Array(order.length)
  order.forEach((i, k) => {
    const [left, top] = view.point(series.x.values[i]!, series.top[i]!)
    xs[k] = left
    ys[k] = top
  })
  return { xs, ys, count: order.length }
}

export const radarKind: ChartSeriesKind<RadarStyle> = {
  type: 'radar',
  polar: true,
  zero: true,
  draw(painter: Painter, series, view) {
    const { xs, ys, count } = corners(series, view)
    if (!count) return
    const style = series.props
    const lineWidth = style.lineWidth ?? 2
    painter.save()
    painter.beginPath()
    tracePoints(painter, xs, ys, count, {})
    painter.closePath()
    painter.fillStyle = series.color
    painter.globalAlpha *= 0.1
    painter.fill()
    painter.restore()
    if (lineWidth > 0) {
      painter.save()
      painter.beginPath()
      tracePoints(painter, xs, ys, count, {})
      painter.closePath()
      painter.strokeStyle = series.color
      painter.lineWidth = lineWidth
      painter.lineJoin = 'round'
      painter.stroke()
      painter.restore()
    }
    const spokes = view.polar?.count ?? count
    if (!(style.dots ?? (spokes <= DOT_SPOKES || count === 1))) return
    const r = Math.max(2.5, lineWidth + 0.5)
    painter.save()
    painter.fillStyle = series.color
    painter.strokeStyle = view.colors.surface
    painter.lineWidth = 1.5
    painter.beginPath()
    for (let k = 0; k < count; k++) {
      painter.moveTo(xs[k]! + r, ys[k]!)
      painter.arc(xs[k]!, ys[k]!, r, 0, Math.PI * 2)
    }
    painter.stroke()
    painter.fill()
    painter.restore()
  },
}
