/**
 * Picks the points worth drawing. A pixel column can't show more than its
 * first, lowest, highest and last point, so a line of a million points is
 * drawn from at most four per column and looks exactly the same.
 */

/** Marks a break in the line: a gap in the data. */
export const BREAK = -1

let pool = new Int32Array(1024)

/**
 * The indices from `from` to `to` (exclusive) to draw, in order, with
 * `BREAK` between runs that a gap (a `NaN` y) splits. With `connect`, gaps
 * are skipped instead. Columns are whole pixels of the x scale `x * k + b`.
 *
 * The returned array is reused by the next call: use it before calling again.
 */
export function decimate(
  xs: Float64Array,
  ys: Float64Array,
  from: number,
  to: number,
  /** Pixel of x is `x * k + b`. */
  k: number,
  b: number,
  connect = false,
): { indices: Int32Array; length: number } {
  // at most 4 per column plus a break per gap; grow when needed
  let out = pool
  let length = 0
  const push = (index: number) => {
    if (length === out.length) {
      const bigger = new Int32Array(out.length * 2)
      bigger.set(out)
      out = pool = bigger
    }
    out[length++] = index
  }

  let column = Number.NaN
  let first = -1
  let last = -1
  let min = -1
  let max = -1
  let low = 0
  let high = 0
  const flush = () => {
    if (first < 0) return
    push(first)
    // the lowest and highest, in the order they come
    const early = min < max ? min : max
    const late = min < max ? max : min
    if (early !== first && early !== last) push(early)
    if (late !== first && late !== last && late !== early) push(late)
    if (last !== first) push(last)
    first = last = min = max = -1
  }

  for (let i = from; i < to; i++) {
    const y = ys[i]!
    const x = xs[i]!
    if (y !== y || x !== x) {
      if (connect) continue
      flush()
      if (length > 0 && out[length - 1] !== BREAK) push(BREAK)
      column = Number.NaN
      continue
    }
    const c = Math.floor(x * k + b)
    if (c !== column) {
      flush()
      column = c
      first = last = min = max = i
      low = high = y
      continue
    }
    last = i
    if (y < low) {
      low = y
      min = i
    } else if (y > high) {
      high = y
      max = i
    }
  }
  flush()
  return { indices: out, length }
}

/**
 * The part of a sorted x column that is on screen, widened by one point on
 * each side so lines run to the edge.
 */
export function visibleRange(
  xs: ArrayLike<number>,
  sorted: boolean,
  lo: number,
  hi: number,
): [number, number] {
  if (!sorted) return [0, xs.length]
  let a = 0
  let b = xs.length
  while (a < b) {
    const mid = (a + b) >>> 1
    if (xs[mid]! < lo) a = mid + 1
    else b = mid
  }
  const from = Math.max(0, a - 1)
  a = from
  b = xs.length
  while (a < b) {
    const mid = (a + b) >>> 1
    if (xs[mid]! <= hi) a = mid + 1
    else b = mid
  }
  return [from, Math.min(xs.length, a + 1)]
}
