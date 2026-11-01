import { barPlacement } from './bar'
import { read, rowCount, rowOf, type ChartAccessor, type ChartData } from './data'
import { visibleRange } from './decimate'
import type { Painter } from './painter'
import type { ChartSeries, ChartSeriesKind, ChartView } from './series'

/*
 * A box plot: for each x, a group of values summed up in five numbers. The
 * box runs from the lower quartile to the upper one with a line at the
 * median; the whiskers reach the farthest values within 1.5 times the box's
 * length of it, and values past them are dots of their own.
 */

export interface BoxStyle {
  /** How far whiskers reach, in box lengths past the box: `1.5` by default, `Infinity` for all the values. */
  whisker?: number
}

export interface BoxStats {
  /** The ends of the whiskers. */
  low: number
  high: number
  q1: number
  median: number
  q3: number
  /** The values past the whiskers. */
  outliers: number[]
  /** How many values there are. */
  count: number
}

/** The `p`th quantile (0 to 1) of sorted values, between the two nearest. */
function quantile(sorted: number[], p: number): number {
  const at = (sorted.length - 1) * p
  const i = Math.floor(at)
  const next = sorted[Math.min(i + 1, sorted.length - 1)]!
  return sorted[i]! + (next - sorted[i]!) * (at - i)
}

/** Sums up a group of values; `null` when none is a number. */
export function boxStats(values: unknown, whisker = 1.5): BoxStats | null {
  if (!values || typeof (values as ArrayLike<unknown>).length !== 'number') return null
  const list: number[] = []
  for (const v of Array.from(values as ArrayLike<unknown>)) {
    const n = typeof v === 'number' ? v : Number(v)
    if (v != null && v !== '' && Number.isFinite(n)) list.push(n)
  }
  if (!list.length) return null
  list.sort((a, b) => a - b)
  const q1 = quantile(list, 0.25)
  const q3 = quantile(list, 0.75)
  const reach = (q3 - q1) * whisker
  let low = q1
  let high = q3
  const outliers: number[] = []
  for (const v of list) {
    if (v < q1 - reach || v > q3 + reach) outliers.push(v)
    else {
      if (v < low) low = v
      if (v > high) high = v
    }
  }
  return { low, high, q1, median: quantile(list, 0.5), q3, outliers, count: list.length }
}

const cache = new WeakMap<object, Map<unknown, Array<BoxStats | null>>>()

/** Each row's numbers, worked out once for the same rows, accessor and whisker. */
export function boxesOf(
  rows: ChartData,
  values: ChartAccessor,
  whisker = 1.5,
): Array<BoxStats | null> {
  let byAccessor = cache.get(rows)
  if (!byAccessor) cache.set(rows, (byAccessor = new Map()))
  const key = `${whisker}`
  let byWhisker = byAccessor.get(values) as unknown as Map<string, Array<BoxStats | null>>
  if (!byWhisker) byAccessor.set(values, (byWhisker = new Map()) as never)
  let out = byWhisker.get(key)
  if (!out) {
    out = []
    const n = rowCount(rows)
    for (let i = 0; i < n; i++) out.push(boxStats(read(rowOf(rows, i), values, i), whisker))
    byWhisker.set(key, out)
  }
  return out
}

/** A box plot series' numbers by row. */
export const boxes = (series: Pick<ChartSeries<BoxStyle>, 'rows' | 'props'>) =>
  boxesOf(series.rows, series.props.y, series.props.whisker)

/** The radius of an outlier's dot, in px. */
const DOT = 2.5

function draw(painter: Painter, series: ChartSeries<BoxStyle>, view: ChartView) {
  const { x: sx, y: sy, dpr, horizontal } = view
  const xs = series.x.values
  const list = boxes(series)
  const [from, to] = visibleRange(xs, series.x.sorted, sx.domain[0], sx.domain[1])
  const { offset, width } = barPlacement(view.band, series.slot)
  const snap = (v: number) => Math.round(v * dpr) / dpr
  // a line 1 px wide on the pixel grid
  const line = (v: number) => snap(v) + 0.5 / dpr
  const p = (u: number, v: number): [number, number] => (horizontal ? [v, u] : [u, v])
  const color = series.color

  painter.save()
  painter.lineWidth = 1
  for (let i = from; i < to; i++) {
    const box = list[i]
    const x = xs[i]!
    if (!box || x !== x) continue
    const u0 = snap(sx.map(x) + offset)
    const u1 = Math.max(u0 + 1, snap(sx.map(x) + offset + width))
    const mid = line((u0 + u1) / 2)
    const cap = Math.max(4, (u1 - u0) / 2)
    const [q1, q3] = [snap(sy.map(box.q1)), snap(sy.map(box.q3))]
    // whiskers and their caps
    painter.strokeStyle = color
    painter.beginPath()
    for (const [end, edge] of [
      [box.low, box.q1],
      [box.high, box.q3],
    ] as const) {
      const v = line(sy.map(end))
      painter.moveTo(...p(mid, snap(sy.map(edge))))
      painter.lineTo(...p(mid, v))
      painter.moveTo(...p(mid - cap / 2, v))
      painter.lineTo(...p(mid + cap / 2, v))
    }
    painter.stroke()
    // the box: a light fill, its outline, and the median across it
    const [x0, y0] = p(u0, Math.min(q1, q3))
    const [x1, y1] = p(u1, Math.max(q1, q3))
    const rect = [Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0)] as const
    painter.beginPath()
    painter.rect(...rect)
    painter.fillStyle = view.colors.surface
    painter.fill()
    painter.save()
    painter.globalAlpha *= 0.16
    painter.fillStyle = color
    painter.fill()
    painter.restore()
    painter.beginPath()
    painter.rect(rect[0] + 0.5, rect[1] + 0.5, Math.max(0, rect[2] - 1), Math.max(0, rect[3] - 1))
    painter.stroke()
    painter.lineWidth = 2
    painter.beginPath()
    const m = snap(sy.map(box.median))
    painter.moveTo(...p(u0, m))
    painter.lineTo(...p(u1, m))
    painter.stroke()
    painter.lineWidth = 1
    // the values past the whiskers: rings, so many on one spot still show
    if (box.outliers.length) {
      painter.beginPath()
      for (const v of box.outliers) {
        const [cx, cy] = p(mid, sy.map(v))
        painter.moveTo(cx + DOT, cy)
        painter.arc(cx, cy, DOT, 0, Math.PI * 2)
      }
      painter.fillStyle = view.colors.surface
      painter.fill()
      painter.stroke()
    }
  }
  painter.restore()
}

export const boxKind: ChartSeriesKind<BoxStyle> = {
  type: 'box',
  box: true,
  band: true,
  draw,
}
