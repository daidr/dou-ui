import { BREAK, decimate, visibleRange } from './decimate'
import { tracePoints, type Painter } from './painter'
import type { ChartView, ResolvedSeries, SeriesKind } from './series'

/** Room a point needs before dots are shown on their own (`dots: 'auto'`). */
const DOT_SPACE = 16
/** Room a point needs before a line may curve: denser data is drawn straight. */
const SMOOTH_SPACE = 3

export interface LineStyle {
  smooth?: boolean
  dots?: boolean | 'auto'
  dashed?: boolean
  width?: number
  connectNulls?: boolean
}

let bufferX = new Float64Array(1024)
let bufferY = new Float64Array(1024)
let bufferB = new Float64Array(1024)

function ensure(length: number) {
  if (bufferX.length >= length) return
  const size = 2 ** Math.ceil(Math.log2(length))
  bufferX = new Float64Array(size)
  bufferY = new Float64Array(size)
  bufferB = new Float64Array(size)
}

/** Draws a line, and with `area` the area under it (or under its slice of a stack). */
export function drawLine(painter: Painter, series: ResolvedSeries, view: ChartView, area: boolean) {
  const style = series.props as LineStyle
  const { x: sx, y: sy, plot } = view
  const xs = series.x.values
  const [from, to] = visibleRange(xs, series.x.sorted, sx.domain[0], sx.domain[1])
  const { indices, length } = decimate(xs, series.top, from, to, sx.k, sx.b, style.connectNulls)
  if (length === 0) return

  const shown = to - from
  const smooth = !!style.smooth && shown * SMOOTH_SPACE <= plot.width
  const lineWidth = style.width ?? 2

  // where an area without a stack grows from: 0, or the bottom edge when 0 is off the axis
  const floor = Math.min(
    Math.max(0, Math.min(sy.domain[0], sy.domain[1])),
    Math.max(sy.domain[0], sy.domain[1]),
  )
  const floorY = sy.kind === 'log' ? sy.range[0] : sy.map(floor)

  ensure(length)
  const runs: Array<[number, number]> = []
  let count = 0
  let start = 0
  for (let k = 0; k <= length; k++) {
    const i = k < length ? indices[k]! : BREAK
    if (i === BREAK) {
      if (count > start) runs.push([start, count])
      start = count
      continue
    }
    bufferX[count] = sx.map(xs[i]!)
    bufferY[count] = sy.map(series.top[i]!)
    bufferB[count] = series.base ? sy.map(series.base[i]!) : floorY
    count++
  }

  if (area) {
    painter.save()
    painter.fillStyle = series.color
    painter.globalAlpha = series.base ? 0.18 : 0.1
    painter.beginPath()
    for (const [a, b] of runs) {
      const xsRun = bufferX.subarray(a, b)
      tracePoints(painter, xsRun, bufferY.subarray(a, b), b - a, { smooth })
      tracePoints(painter, xsRun, bufferB.subarray(a, b), b - a, {
        smooth,
        reverse: true,
        join: true,
      })
      painter.closePath()
    }
    painter.fill()
    painter.restore()
  }

  painter.save()
  painter.strokeStyle = series.color
  painter.lineWidth = lineWidth
  painter.lineJoin = 'round'
  painter.lineCap = 'round'
  if (style.dashed) painter.setLineDash([lineWidth * 3, lineWidth * 2.5])
  painter.beginPath()
  for (const [a, b] of runs)
    tracePoints(painter, bufferX.subarray(a, b), bufferY.subarray(a, b), b - a, { smooth })
  painter.stroke()
  painter.restore()

  const dots = style.dots ?? 'auto'
  // a point standing alone (a gap on both sides) is invisible without its dot
  const every = dots === true || (dots === 'auto' && shown * DOT_SPACE <= plot.width)
  const lonely = runs.some(([a, b]) => b - a === 1)
  if (every || lonely) {
    const r = Math.max(2.5, lineWidth + 0.5)
    painter.save()
    painter.fillStyle = series.color
    painter.strokeStyle = view.colors.surface
    painter.lineWidth = 1.5
    painter.beginPath()
    for (const [a, b] of runs) {
      if (!every && b - a > 1) continue
      for (let k = a; k < b; k++) {
        painter.moveTo(bufferX[k]! + r, bufferY[k]!)
        painter.arc(bufferX[k]!, bufferY[k]!, r, 0, Math.PI * 2)
      }
    }
    painter.stroke()
    painter.fill()
    painter.restore()
  }
}

export const lineKind: SeriesKind = {
  name: 'line',
  zero: false,
  stacks: false,
  draw: (painter, series, view) => drawLine(painter, series, view, false),
}

export const areaKind: SeriesKind = {
  name: 'area',
  zero: true,
  stacks: true,
  draw: (painter, series, view) => drawLine(painter, series, view, true),
}
