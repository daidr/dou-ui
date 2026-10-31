/*
 * Finding what is under the pointer: the x nearest to it (for a tooltip of
 * every series at one x), or the point nearest to it (for one point).
 */
import type { Scale } from './scale'

const orders = new WeakMap<Float64Array, Int32Array>()

/** The indices of `values` from the smallest to the largest, `NaN` left out. Cached per array. */
export function sortedOrder(values: Float64Array): Int32Array {
  let order = orders.get(values)
  if (!order) {
    let n = 0
    for (let i = 0; i < values.length; i++) if (values[i] === values[i]) n++
    order = new Int32Array(n)
    for (let i = 0, j = 0; i < values.length; i++) if (values[i] === values[i]) order[j++] = i
    let sorted = true
    for (let j = 1; j < n && sorted; j++)
      if (values[order[j]!]! < values[order[j - 1]!]!) sorted = false
    // oxlint-disable-next-line unicorn/no-array-sort -- sorts its own array
    if (!sorted) order.sort((a, b) => values[a]! - values[b]!)
    orders.set(values, order)
  }
  return order
}

/** The position in `order` of the first value not below `value`. */
function lowerBound(values: Float64Array, order: Int32Array, value: number): number {
  let lo = 0
  let hi = order.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (values[order[mid]!]! < value) lo = mid + 1
    else hi = mid
  }
  return lo
}

/** The row of `values` whose value is exactly `value`, or -1. */
export function rowAt(values: Float64Array, value: number): number {
  const order = sortedOrder(values)
  const at = lowerBound(values, order, value)
  return at < order.length && values[order[at]!] === value ? order[at]! : -1
}

/**
 * Of all the x values of `columns`, the one nearest to `pixel` along the
 * x scale; `null` when there are none. Category axes snap to the nearest
 * category.
 */
export function nearestX(columns: Float64Array[], scale: Scale, pixel: number): number | null {
  const target = scale.invert(pixel)
  let best: number | null = null
  let distance = Infinity
  for (const values of columns) {
    const order = sortedOrder(values)
    if (!order.length) continue
    const at = lowerBound(values, order, target)
    for (const k of [at - 1, at]) {
      if (k < 0 || k >= order.length) continue
      const value = values[order[k]!]!
      const d = Math.abs(scale.map(value) - pixel)
      if (d < distance) [best, distance] = [value, d]
    }
  }
  return best
}

/** The x values of `columns` together, from the smallest, each once. */
export function allX(columns: Float64Array[]): number[] {
  const seen = new Set<number>()
  for (const values of columns) for (const value of values) if (value === value) seen.add(value)
  // oxlint-disable-next-line unicorn/no-array-sort -- sorts its own array
  return [...seen].sort((a, b) => a - b)
}

/**
 * The point nearest to `(px, py)` among `n` points placed by `point`,
 * if one is within `reach(i)` px of it. Points of equal distance go to the
 * one drawn last, which is on top.
 */
export function nearestPoint(
  n: number,
  point: (i: number) => [number, number] | null,
  px: number,
  py: number,
  reach: (i: number) => number,
): { index: number; distance: number } | null {
  let index = -1
  let distance = Infinity
  for (let i = 0; i < n; i++) {
    const at = point(i)
    if (!at) continue
    const dx = at[0] - px
    const dy = at[1] - py
    const d = Math.sqrt(dx * dx + dy * dy)
    if (d <= reach(i) && d <= distance) [index, distance] = [i, d]
  }
  return index < 0 ? null : { index, distance }
}

/** Angles clockwise from 12 o'clock, as pies use them. */
export function angleAt(cx: number, cy: number, px: number, py: number): number {
  const angle = Math.atan2(px - cx, cy - py)
  return angle < 0 ? angle + Math.PI * 2 : angle
}
