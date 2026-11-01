import { barLabels, barPlacement } from './bar'
import { read, rowOf, type ChartAccessor, type ChartData } from './data'
import { visibleRange } from './decimate'
import type { Painter } from './painter'
import type { ChartSeries, ChartSeriesKind } from './series'

/*
 * A waterfall: each row a change, drawn as a bar floating from the running
 * total before it to the total after; a total row (`total`) is a bar from
 * 0 up to the running total so far. A thin line joins each bar's end to
 * the next bar, at the total they share.
 */

export interface WaterfallStyle {
  /** Whether a row is a total: a key of the row or a function of it. */
  total?: ChartAccessor
  /** Corner radius of the bars, in px. */
  radius?: number
  /** Lines from each bar to the next, at the total they share. */
  connectors?: boolean
  labelPosition?: 'outside' | 'inside'
}

/**
 * The bars of a waterfall: where each starts (`base`) and ends (`top`), and
 * its value (`y`): the change, or for a total row, the running total. A
 * row without a value is left out and changes nothing.
 */
export function waterfallSteps(
  rows: ChartData,
  changes: Float64Array,
  total: ChartAccessor | undefined,
): { y: Float64Array; top: Float64Array; base: Float64Array } {
  const n = changes.length
  const y = new Float64Array(n)
  const top = new Float64Array(n)
  const base = new Float64Array(n)
  let sum = 0
  for (let i = 0; i < n; i++) {
    if (total !== undefined && read(rowOf(rows, i), total, i)) {
      y[i] = top[i] = sum
      base[i] = 0
      continue
    }
    const change = changes[i]!
    if (change !== change) {
      y[i] = top[i] = base[i] = Number.NaN
      continue
    }
    y[i] = change
    base[i] = sum
    sum += change
    top[i] = sum
  }
  return { y, top, base }
}

/** Whether row `i` of a waterfall is a total. */
export function isTotal(series: Pick<ChartSeries<WaterfallStyle>, 'props' | 'rows'>, i: number) {
  const total = series.props.total
  return total !== undefined && !!read(rowOf(series.rows, i), total, i)
}

function draw(
  painter: Painter,
  series: ChartSeries<WaterfallStyle>,
  view: Parameters<ChartSeriesKind['draw']>[2],
) {
  const { x: sx, y: sy, dpr, horizontal } = view
  const xs = series.x.values
  const { top, base } = series
  if (!base) return
  const [from, to] = visibleRange(xs, series.x.sorted, sx.domain[0], sx.domain[1])
  const { offset, width } = barPlacement(view.band, series.slot)
  const snap = (v: number) => Math.round(v * dpr) / dpr
  const radius = Math.max(0, series.props.radius ?? 2)
  const p = (u: number, v: number): [number, number] => (horizontal ? [v, u] : [u, v])

  // the lines first, under the bars: from each bar's end to the next bar
  if (series.props.connectors ?? true) {
    painter.save()
    painter.strokeStyle = view.colors.baseline
    painter.lineWidth = 1
    painter.setLineDash([3, 3])
    painter.beginPath()
    let last = -1
    for (let i = from; i < to; i++) {
      if (top[i] !== top[i] || xs[i] !== xs[i]) continue
      if (last >= 0) {
        // the total after the last bar, where this one starts (or a total bar ends)
        const v = snap(sy.map(top[last]!)) + 0.5
        const u0 = snap(sx.map(xs[last]!) + offset + width)
        const u1 = snap(sx.map(xs[i]!) + offset)
        if (u1 > u0) {
          painter.moveTo(...p(u0, v))
          painter.lineTo(...p(u1, v))
        }
      }
      last = i
    }
    painter.stroke()
    painter.restore()
  }

  const bar = (i: number) => {
    const value = top[i]!
    const x = xs[i]!
    if (value !== value || x !== x) return
    const u0 = snap(sx.map(x) + offset)
    const u1 = Math.max(u0 + 1 / dpr, snap(sx.map(x) + offset + width))
    let v0 = snap(sy.map(base[i]!))
    let v1 = snap(sy.map(value))
    // no change still shows, as a hairline at the total
    if (Math.abs(v1 - v0) < 1) [v0, v1] = [v0 - 0.5, v0 + 0.5]
    const lo = Math.min(v0, v1)
    const hi = Math.max(v0, v1)
    const r = Math.min(radius, (u1 - u0) / 2, (hi - lo) / 2)
    // the corners round, but not at an end that stands on 0 (a total's foot)
    const zero = snap(sy.map(0))
    const rLo = Math.abs(lo - zero) < 1 ? 0 : r
    const rHi = Math.abs(hi - zero) < 1 ? 0 : r
    if (r < 0.5) {
      const [x0, y0] = p(u0, lo)
      const [x1, y1] = p(u1, hi)
      painter.rect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0))
      return
    }
    const corner = (u: number, v: number, nu: number, nv: number, cr: number) => {
      if (cr > 0) painter.arcTo(...p(u, v), ...p(nu, nv), cr)
      else painter.lineTo(...p(u, v))
    }
    painter.moveTo(...p((u0 + u1) / 2, lo))
    corner(u1, lo, u1, hi, rLo)
    corner(u1, hi, u0, hi, rHi)
    corner(u0, hi, u0, lo, rHi)
    corner(u0, lo, u1, lo, rLo)
    painter.closePath()
  }

  painter.save()
  const groups = new Map<string, number[]>()
  for (let i = from; i < to; i++) {
    const color = series.colors?.[i] ?? series.color
    let group = groups.get(color)
    if (!group) groups.set(color, (group = []))
    group.push(i)
  }
  for (const [color, rows] of groups) {
    painter.fillStyle = color
    painter.beginPath()
    for (const i of rows) bar(i)
    painter.fill()
  }
  painter.restore()
}

export const waterfallKind: ChartSeriesKind<WaterfallStyle> = {
  type: 'bar',
  waterfall: true,
  zero: true,
  band: true,
  draw,
  labels: barLabels,
}
