import { visibleRange } from './decimate'
import type { Painter } from './painter'
import { baseline } from './scale'
import type { ChartLabelAnchor, ChartSeries, ChartSeriesKind, ChartView } from './series'

export interface BarStyle {
  /** Corner radius of the bar's end, in px. */
  radius?: number
  labelPosition?: 'outside' | 'inside'
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
  const log = sy.kind === 'log'
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
      if (value !== value || x !== x || (log && !(value > 0))) continue
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
  const bar = (i: number) => {
    const value = top[i]!
    const x = xs[i]!
    if (value !== value || x !== x) return
    // a log axis has no 0 to grow from, nor room for values at or below it
    if (log && !(value > 0)) {
      warnLog()
      return
    }
    const from0 = base ? base[i]! : 0
    if (value === from0) return
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
  const own = series.colors
  if (own) {
    // bars of their own color: one shape per color
    const groups = new Map<string, number[]>()
    for (let i = from; i < to; i++) {
      const color = own[i] ?? series.color
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
  } else {
    for (let i = from; i < to; i++) bar(i)
    painter.fill()
  }
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

let logWarned = false
function warnLog() {
  if (process.env.NODE_ENV === 'production' || logWarned) return
  logWarned = true
  console.warn(
    '[@dou-ui/chart] bars on a log axis grow from its start; values at or below 0 are left out.',
  )
}

/** Bars narrower than this (px) get no labels: they couldn't be told apart. */
const LABEL_WIDTH = 8

/**
 * Where bars' labels go: past each bar's end, or in its middle (stacked
 * bars, by default), with the bar to fit in.
 */
export function barLabels(series: ChartSeries<BarStyle>, view: ChartView): ChartLabelAnchor[] {
  const { x: sx, y: sy, horizontal } = view
  const { offset, width } = barPlacement(view.band, series.slot)
  if (width < LABEL_WIDTH) return []
  const xs = series.x.values
  const top = series.top
  const base = series.base
  const [from, to] = visibleRange(xs, series.x.sorted, sx.domain[0], sx.domain[1])
  const inside =
    (series.props.labelPosition ?? (series.stackEnds ? 'inside' : 'outside')) === 'inside'
  const zero = baseline(sy)
  // past its end, a label may take its bar's share of the x band, no more
  const room = view.band / (series.slot?.count ?? 1)
  const out: ChartLabelAnchor[] = []
  for (let i = from; i < to; i++) {
    const value = top[i]!
    const x = xs[i]!
    if (value !== value || x !== x) continue
    const from0 = base ? base[i]! : 0
    if (value === from0 || (sy.kind === 'log' && !(value > 0))) continue
    const u = sx.map(x) + offset + width / 2
    const v1 = sy.map(value)
    const v0 = base ? sy.map(from0) : zero
    const up = value > from0
    if (inside) {
      const lo = Math.min(v0, v1)
      const length = Math.abs(v1 - v0)
      const box = horizontal
        ? { x: lo, y: u - width / 2, width: length, height: width }
        : { x: u - width / 2, y: lo, width, height: length }
      const middle = (v0 + v1) / 2
      out.push({
        index: i,
        at: horizontal ? [middle, u] : [u, middle],
        side: 'center',
        box: { ...box, color: series.colors?.[i] ?? series.color },
      })
    } else {
      // past the end away from 0: above a bar going up, below one going down
      const side = horizontal ? (up ? 'right' : 'left') : up ? 'top' : 'bottom'
      out.push({ index: i, at: horizontal ? [v1, u] : [u, v1], side, room })
    }
  }
  return out
}

export const barKind: ChartSeriesKind<BarStyle> = {
  type: 'bar',
  zero: true,
  stackable: true,
  band: true,
  draw: drawBars,
  labels: barLabels,
}
