import { visibleRange } from './decimate'
import type { Painter } from './painter'
import { baseline } from './scale'
import type { ChartSeries, ChartSeriesKind, ChartView } from './series'

export interface BarStyle {
  /** Corner radius of the bar's end, in px. */
  radius?: number
}

/** The part of each x band that a group of bars takes, alone and side by side. */
const SINGLE = 0.6
const GROUPED = 0.76
/** The widest a bar gets, in px. */
const MAX_WIDTH = 56
/** The room between bars of a group, in px. */
const GAP = 2
/** Below this width (px), bars are drawn one column of pixels at a time. */
const DENSE = 1.5

/**
 * Where a series' bars go in each x band: the offset of their near edge
 * from the band's center, and their width, in px.
 */
export function barPlacement(
  band: number,
  slot: { index: number; count: number } | null,
): { offset: number; width: number } {
  const { index, count } = slot ?? { index: 0, count: 1 }
  let group = band * (count > 1 ? GROUPED : SINGLE)
  let gap = count > 1 && group / count >= GAP * 4 ? GAP : 0
  let width = (group - gap * (count - 1)) / count
  if (width > MAX_WIDTH) {
    width = MAX_WIDTH
    gap = count > 1 ? GAP * 2 : 0
    group = width * count + gap * (count - 1)
  }
  return { offset: -group / 2 + index * (width + gap), width }
}

/**
 * Draws bars from 0 (or from the slice of the stack below) to each value.
 * The end away from 0 is rounded; in a stack, only the outermost slice's.
 * Bars narrower than a pixel and a half are merged per pixel column into
 * one bar from the lowest to the highest value there, which looks the
 * same and keeps a million bars as cheap as a few hundred.
 */
export function drawBars(painter: Painter, series: ChartSeries<BarStyle>, view: ChartView) {
  const { x: sx, y: sy, dpr, horizontal } = view
  const xs = series.x.values
  const top = series.top
  const base = series.base
  const ends = series.stackEnds
  const [from, to] = visibleRange(xs, series.x.sorted, sx.domain[0], sx.domain[1])
  const { offset, width } = barPlacement(view.band, series.slot)
  const zero = baseline(sy)
  const snap = (v: number) => Math.round(v * dpr) / dpr

  // a bar is drawn along `u` (the x axis) and `v` (the value axis); swapped when horizontal
  const rect = (u0: number, u1: number, v0: number, v1: number) =>
    horizontal
      ? painter.rect(Math.min(v0, v1), u0, Math.abs(v1 - v0), u1 - u0)
      : painter.rect(u0, Math.min(v0, v1), u1 - u0, Math.abs(v1 - v0))

  painter.save()
  painter.fillStyle = series.color
  painter.beginPath()

  if (width < DENSE) {
    // one column per pixel: from the lowest to the highest end of the bars in it
    let column = Number.NaN
    let lo = 0
    let hi = 0
    const flush = () => {
      if (column === column && hi > lo) rect(column, column + 1, lo, hi)
    }
    for (let i = from; i < to; i++) {
      const value = top[i]!
      const x = xs[i]!
      if (value !== value || x !== x) continue
      const v1 = sy.map(value)
      const v0 = base ? sy.map(base[i]!) : zero
      const c = Math.floor(sx.map(x) + offset + width / 2)
      if (c !== column) {
        flush()
        column = c
        lo = Math.min(v0, v1)
        hi = Math.max(v0, v1)
      } else {
        lo = Math.min(lo, v0, v1)
        hi = Math.max(hi, v0, v1)
      }
    }
    flush()
    painter.fill()
    painter.restore()
    return
  }

  const radius = Math.max(0, series.props.radius ?? 2)
  for (let i = from; i < to; i++) {
    const value = top[i]!
    const x = xs[i]!
    if (value !== value || x !== x) continue
    const from0 = base ? base[i]! : 0
    if (value === from0) continue
    const u0 = snap(sx.map(x) + offset)
    const u1 = Math.max(u0 + 1 / dpr, snap(sx.map(x) + offset + width))
    let v0 = base ? sy.map(from0) : zero
    const v1 = sy.map(value)
    const length = Math.abs(v1 - v0)
    // a slice on another one leaves a hairline of room between them
    if (base && from0 !== 0 && length > 2) v0 += v1 > v0 ? 1 : -1
    const outermost = !ends || (value > from0 ? value === ends.up[i] : value === ends.down[i])
    const r = outermost ? Math.min(radius, (u1 - u0) / 2, Math.abs(v1 - v0)) : 0
    if (r < 0.5) rect(u0, u1, v0, v1)
    else roundedEnd(painter, u0, u1, v0, v1, r, horizontal)
  }
  painter.fill()
  painter.restore()
}

/** A bar from `v0` to `v1` with the corners at `v1` rounded. */
function roundedEnd(
  painter: Painter,
  u0: number,
  u1: number,
  v0: number,
  v1: number,
  r: number,
  swap: boolean,
) {
  const p = (u: number, v: number): [number, number] => (swap ? [v, u] : [u, v])
  // the side the corners curve away from: back towards v0
  const back = v1 < v0 ? r : -r
  painter.moveTo(...p(u0, v0))
  painter.lineTo(...p(u0, v1 + back))
  painter.arcTo(...p(u0, v1), ...p(u0 + r, v1), r)
  painter.lineTo(...p(u1 - r, v1))
  painter.arcTo(...p(u1, v1), ...p(u1, v1 + back), r)
  painter.lineTo(...p(u1, v0))
  painter.closePath()
}

export const barKind: ChartSeriesKind<BarStyle> = {
  name: 'bar',
  zero: true,
  stacks: true,
  band: true,
  draw: drawBars,
}
