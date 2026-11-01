import { BREAK, decimate, summarize, visibleRange } from './decimate'
import { tracePoints, type Painter } from './painter'
import { fillPattern } from './pattern'
import { baseline } from './scale'
import type { ChartLabelAnchor, ChartSeries, ChartSeriesKind, ChartView } from './series'

/** Room a point needs before dots are shown on their own (`dots: 'auto'`). */
const DOT_SPACE = 16
/** Room a point needs before a line may curve: denser data is drawn straight. */
const SMOOTH_SPACE = 3

export interface LineStyle {
  smooth?: boolean
  dots?: boolean | 'auto'
  dashed?: boolean
  lineWidth?: number
  connectNulls?: boolean
  step?: boolean | 'before' | 'after' | 'middle'
  labelPosition?: 'point' | 'end'
  /** An area's bottom of its own (a band); the model reads it into `base`. */
  y0?: unknown
}

/** Room a point needs before each gets a label. */
const LABEL_SPACE = 12

type StepMode = 'before' | 'after' | 'middle'

/**
 * The corners of a line that steps through `count` points: `after` holds
 * each value until the next x, `before` takes the next value at once,
 * `middle` changes halfway. Gives the corners' x, the values (`ys`, and
 * `bs` for an area's bottom, stepped the same way) and how many there are.
 */
export function stepPoints(
  px: ArrayLike<number>,
  ys: ArrayLike<number>,
  bs: ArrayLike<number>,
  count: number,
  mode: StepMode,
): { x: Float64Array; y: Float64Array; b: Float64Array; count: number } {
  const per = mode === 'middle' ? 3 : 2
  const n = count > 0 ? (count - 1) * per + 1 : 0
  const x = new Float64Array(n)
  const y = new Float64Array(n)
  const b = new Float64Array(n)
  let k = 0
  const put = (u: number, i: number) => {
    x[k] = u
    y[k] = ys[i]!
    b[k] = bs[i]!
    k++
  }
  for (let i = 0; i < count; i++) {
    if (i > 0) {
      const u0 = px[i - 1]!
      const u1 = px[i]!
      if (mode === 'after') put(u1, i - 1)
      else if (mode === 'before') put(u0, i)
      else {
        const m = (u0 + u1) / 2
        put(m, i - 1)
        put(m, i)
      }
    }
    put(px[i]!, i)
  }
  return { x, y, b, count: k }
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
export function drawLine(
  painter: Painter,
  series: ChartSeries<LineStyle>,
  view: ChartView,
  area: boolean,
) {
  const style = series.props
  const { x: sx, y: sy, plot, horizontal: swap } = view
  const along = swap ? plot.height : plot.width
  const xs = series.x.values
  const [from, to] = visibleRange(xs, series.x.sorted, sx.domain[0], sx.domain[1])
  const { indices, length } = decimate(
    xs,
    series.top,
    from,
    to,
    sx.k,
    sx.b,
    style.connectNulls,
    series.x.sorted,
  )
  if (length === 0) return

  const shown = to - from
  const step: StepMode | null =
    style.step === true ? 'after' : style.step ? (style.step as StepMode) : null
  const smooth = !step && !!style.smooth && shown * SMOOTH_SPACE <= along
  const lineWidth = style.lineWidth ?? 2
  // an area with a bottom of its own: a band, with a line along both edges
  const band = area && !!series.base && !series.stackEnds

  // where an area without a stack grows from
  const floorY = baseline(sy)

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

  // the runs as drawn: their corners, when the line steps
  const drawn = runs.map(([a, b]) => {
    const xsRun = bufferX.subarray(a, b)
    const ysRun = bufferY.subarray(a, b)
    const bsRun = bufferB.subarray(a, b)
    if (!step) return { x: xsRun, y: ysRun, b: bsRun, count: b - a }
    return stepPoints(xsRun, ysRun, bsRun, b - a, step)
  })

  if (area) {
    painter.save()
    painter.fillStyle = series.color
    painter.globalAlpha *= series.base ? 0.18 : 0.1
    painter.beginPath()
    for (const run of drawn) {
      tracePoints(painter, run.x, run.y, run.count, { smooth, swap })
      tracePoints(painter, run.x, run.b, run.count, { smooth, swap, reverse: true, join: true })
      painter.closePath()
    }
    painter.fill()
    painter.restore()
    // on a light fill, the pattern is in the series' color (the path is still the area's)
    if (series.pattern) fillPattern(painter, series.pattern, view.plot, series.color, 0.5)
  }

  if (lineWidth > 0) {
    painter.save()
    painter.strokeStyle = series.color
    painter.lineWidth = lineWidth
    painter.lineJoin = 'round'
    painter.lineCap = 'round'
    if (style.dashed) painter.setLineDash([lineWidth * 3, lineWidth * 2.5])
    painter.beginPath()
    for (const run of drawn) {
      tracePoints(painter, run.x, run.y, run.count, { smooth, swap })
      if (band) tracePoints(painter, run.x, run.b, run.count, { smooth, swap })
    }
    painter.stroke()
    painter.restore()
  }

  // a band's edges are a range, not points: dots only when asked for
  const dots = style.dots ?? (band ? false : 'auto')
  // a point standing alone (a gap on both sides) is invisible without its dot
  const every = dots === true || (dots === 'auto' && !band && shown * DOT_SPACE <= along)
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
        const [cx, cy] = swap ? [bufferY[k]!, bufferX[k]!] : [bufferX[k]!, bufferY[k]!]
        painter.moveTo(cx + r, cy)
        painter.arc(cx, cy, r, 0, Math.PI * 2)
      }
    }
    painter.stroke()
    painter.fill()
    painter.restore()
  }
}

/**
 * Where a line's labels go: above each point when there is room for them
 * all, or beside the last point shown (`end`).
 */
export function lineLabels(series: ChartSeries<LineStyle>, view: ChartView): ChartLabelAnchor[] {
  const { x: sx, plot, horizontal } = view
  const xs = series.x.values
  const top = series.top
  const [from, to] = visibleRange(xs, series.x.sorted, sx.domain[0], sx.domain[1])
  const at = (i: number) => view.point(xs[i]!, top[i]!)
  const valued = (i: number) => xs[i] === xs[i] && top[i] === top[i]
  if (series.props.labelPosition === 'end') {
    let last = -1
    for (let i = to - 1; i >= from; i--)
      if (valued(i) && (!series.x.sorted || last < 0 || xs[i]! > xs[last]!)) {
        last = i
        if (series.x.sorted) break
      }
    return last < 0 ? [] : [{ index: last, at: at(last), side: horizontal ? 'bottom' : 'right' }]
  }
  const along = horizontal ? plot.height : plot.width
  if ((to - from) * LABEL_SPACE > along) return []
  // a reversed value axis: what is above in value is below on screen
  const [r0, r1] = view.y.range
  const flipped = horizontal ? r0 > r1 : r0 < r1
  const out: ChartLabelAnchor[] = []
  for (let i = from; i < to; i++) {
    if (!valued(i)) continue
    // below a point that dips under 0, above the others
    const down = (series.y[i]! < 0 && !series.stackEnds) !== flipped
    out.push({
      index: i,
      at: at(i),
      side: horizontal ? (down ? 'left' : 'right') : down ? 'bottom' : 'top',
    })
  }
  return out
}

/** For a long line: what lets zooming and panning skip over most of it. */
function prepare(series: ChartSeries<LineStyle>) {
  return series.x.sorted ? summarize(series.x.values, series.top) : null
}

export const lineKind: ChartSeriesKind<LineStyle> = {
  type: 'line',
  draw: (painter, series, view) => drawLine(painter, series, view, false),
  prepare,
  labels: lineLabels,
}

export const areaKind: ChartSeriesKind<LineStyle> = {
  type: 'area',
  zero: true,
  stackable: true,
  draw: (painter, series, view) => drawLine(painter, series, view, true),
  prepare,
  labels: lineLabels,
}
