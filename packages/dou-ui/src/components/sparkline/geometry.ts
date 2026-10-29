import type { SparklineValue } from './sparkline'

/** The drawing is laid out in this box and stretched to the element's size. */
export const VIEW_WIDTH = 1000
export const VIEW_HEIGHT = 100

export interface Point {
  /** The datum's position in `data`. */
  index: number
  value: number
}

export interface Datum {
  value: number | null
  label?: string
}

/** Read each entry as a number or a gap. `NaN` and infinities count as gaps. */
export function normalize(data: readonly SparklineValue[]): Datum[] {
  return data.map((entry) => {
    const datum =
      entry !== null && typeof entry === 'object' ? entry : { value: entry as number | null }
    const value =
      typeof datum.value === 'number' && Number.isFinite(datum.value) ? datum.value : null
    return datum.label === undefined ? { value } : { value, label: datum.label }
  })
}

export interface Extremes {
  first: Point | null
  last: Point | null
  /** The first occurrence of the lowest value. */
  min: Point | null
  /** The first occurrence of the highest value. */
  max: Point | null
  /** How many entries are numbers. */
  count: number
}

export function extremes(data: readonly Datum[]): Extremes {
  let first: Point | null = null
  let last: Point | null = null
  let min: Point | null = null
  let max: Point | null = null
  let count = 0
  for (let index = 0; index < data.length; index++) {
    const value = data[index]!.value
    if (value === null) continue
    count++
    const point = { index, value }
    first ??= point
    last = point
    if (!min || value < min.value) min = point
    if (!max || value > max.value) max = point
  }
  return { first, last, min, max, count }
}

export interface Domain {
  low: number
  high: number
}

/**
 * The value range the height covers. Bars always include zero, since their
 * length stands for the value. A flat series gets a range around its value,
 * so it sits in the middle instead of on an edge.
 */
export function domain(
  range: Extremes,
  options: { min?: number; max?: number; zero: boolean },
): Domain {
  let low = options.min ?? range.min?.value ?? 0
  let high = options.max ?? range.max?.value ?? 0
  if (options.zero) {
    low = Math.min(low, 0)
    high = Math.max(high, 0)
  }
  if (low > high) [low, high] = [high, low]
  if (low === high) {
    // keep zero on the baseline for bars of all-zero data
    const spread = Math.abs(low) || 1
    return options.zero && low === 0
      ? { low: 0, high: 1 }
      : { low: low - spread, high: high + spread }
  }
  return { low, high }
}

/** The vertical position of a value, `0` at the top. Values beyond the range sit on its edge. */
export function yOf(value: number, { low, high }: Domain): number {
  const share = (value - low) / (high - low)
  return (1 - Math.min(1, Math.max(0, share))) * VIEW_HEIGHT
}

/** The horizontal position of a line point. A single point sits in the middle. */
export function xOf(index: number, length: number): number {
  return length <= 1 ? VIEW_WIDTH / 2 : (index / (length - 1)) * VIEW_WIDTH
}

/** Unbroken runs of numbers; a gap ends a run. */
export function runs(data: readonly Datum[]): Point[][] {
  const result: Point[][] = []
  let current: Point[] = []
  for (let index = 0; index < data.length; index++) {
    const value = data[index]!.value
    if (value === null) {
      if (current.length) result.push(current)
      current = []
    } else current.push({ index, value })
  }
  if (current.length) result.push(current)
  return result
}

/**
 * Thin a run to at most two points per bucket of `span` indices, keeping the
 * lowest and highest of each bucket in their order. Peaks and dips survive
 * exactly, which plain sampling would miss.
 */
export function decimate(run: Point[], span: number): Point[] {
  if (span <= 1 || run.length <= 2) return run
  const result: Point[] = []
  let start = 0
  while (start < run.length) {
    const bucket = Math.floor(run[start]!.index / span)
    let end = start
    let low = run[start]!
    let high = run[start]!
    while (end < run.length && Math.floor(run[end]!.index / span) === bucket) {
      const point = run[end]!
      if (point.value < low.value) low = point
      if (point.value > high.value) high = point
      end++
    }
    if (low === high) result.push(low)
    else if (low.index < high.index) result.push(low, high)
    else result.push(high, low)
    start = end
  }
  // the ends of the run stay where they are
  if (result[0] !== run[0]) result.unshift(run[0]!)
  if (result.at(-1) !== run.at(-1)) result.push(run.at(-1)!)
  return result
}

const round = (value: number) => Math.round(value * 100) / 100

/**
 * Tangents for a monotone cubic curve (Fritsch–Carlson): the curve never
 * rises above or dips below its neighboring points, so it never shows a
 * value the data doesn't have.
 */
function tangents(xs: number[], ys: number[]): number[] {
  const n = xs.length
  const slopes: number[] = []
  for (let i = 0; i < n - 1; i++) slopes.push((ys[i + 1]! - ys[i]!) / (xs[i + 1]! - xs[i]!))
  const result: number[] = [slopes[0]!]
  for (let i = 1; i < n - 1; i++) {
    const a = slopes[i - 1]!
    const b = slopes[i]!
    result.push(a * b <= 0 ? 0 : (3 * (a + b)) / (2 / a + 1 / b + (1 / a + 2 / b)))
  }
  result.push(slopes[n - 2]!)
  return result
}

/** The `d` of a path through the points, straight or smooth. */
export function linePath(xs: number[], ys: number[], smooth: boolean): string {
  const n = xs.length
  if (!n) return ''
  const parts = [`M${round(xs[0]!)} ${round(ys[0]!)}`]
  if (n === 1) return parts[0]!
  if (!smooth || n === 2) {
    for (let i = 1; i < n; i++) parts.push(`L${round(xs[i]!)} ${round(ys[i]!)}`)
    return parts.join('')
  }
  const m = tangents(xs, ys)
  for (let i = 0; i < n - 1; i++) {
    const dx = (xs[i + 1]! - xs[i]!) / 3
    parts.push(
      `C${round(xs[i]! + dx)} ${round(ys[i]! + m[i]! * dx)} ${round(xs[i + 1]! - dx)} ${round(
        ys[i + 1]! - m[i + 1]! * dx,
      )} ${round(xs[i + 1]!)} ${round(ys[i + 1]!)}`,
    )
  }
  return parts.join('')
}

export interface Bar {
  /** The datum the bar stands for. */
  index: number
  x: number
  y: number
  width: number
  height: number
  /** Grows down from zero, for a negative value. */
  down: boolean
}

/**
 * One bar per slot, growing from zero. When there are more values than
 * `slots`, neighboring values share a bar that shows the one farthest from
 * zero, so no peak is hidden.
 */
export function bars(data: readonly Datum[], range: Domain, slots: number): Bar[] {
  const length = data.length
  if (!length) return []
  const groups = Math.max(1, Math.min(length, Math.floor(slots)))
  const per = length / groups
  const slot = VIEW_WIDTH / groups
  // a clear gap keeps neighboring bars apart even when they are thin
  const gap = groups > 1 ? slot * 0.3 : 0
  const zero = yOf(0, range)
  const result: Bar[] = []
  for (let group = 0; group < groups; group++) {
    let pick: Point | null = null
    const end = Math.min(length, Math.round((group + 1) * per))
    for (let index = Math.round(group * per); index < end; index++) {
      const value = data[index]!.value
      if (value !== null && (!pick || Math.abs(value) > Math.abs(pick.value)))
        pick = { index, value }
    }
    if (!pick) continue
    const y = yOf(pick.value, range)
    result.push({
      index: pick.index,
      x: round(group * slot + gap / 2),
      y: round(Math.min(y, zero)),
      width: round(slot - gap),
      height: round(Math.abs(zero - y)),
      down: pick.value < 0,
    })
  }
  return result
}
