/**
 * Picks the points worth drawing. A pixel column can't show more than its
 * first, lowest, highest and last point, so a line of a million points is
 * drawn from at most four per column and looks exactly the same.
 */

/** Marks a break in the line: a gap in the data. */
export const BREAK = -1

let pool = new Int32Array(1024)

/*
 * Summaries of a long sorted line, for skipping over it: for each block of
 * 32 points (then of 32 blocks, and so on) the lowest and highest point in
 * it and whether it has a gap. A block that falls in one pixel column is
 * taken whole, so a column of thousands of points costs a few dozen steps.
 * Made when the page is idle (see `prepare`), not for data that is drawn
 * once and replaced, as live data is.
 */

/** Points per block at the first level; each level up takes this many blocks. */
const SHIFT = 5
const BLOCK = 1 << SHIFT
/** Below this many points a line is quick enough without summaries. */
const SUMMARIZED = 1 << 14

interface Level {
  /** Points per block. */
  size: number
  /** The row of the lowest and the highest y in each block. */
  low: Int32Array
  high: Int32Array
  /** Whether a block has a gap (a `NaN` x or y). */
  gap: Uint8Array
}

const summaries = new WeakMap<Float64Array, { xs: Float64Array; levels: Level[] }>()

/** The summaries of `ys` along `xs` if they have been made. */
function summaryOf(xs: Float64Array, ys: Float64Array): Level[] | null {
  const known = summaries.get(ys)
  return known && known.xs === xs ? known.levels : null
}

/** Makes the summaries of a sorted line long enough to need them, finest first. */
export function summarize(xs: Float64Array, ys: Float64Array): Level[] | null {
  if (Math.min(xs.length, ys.length) < SUMMARIZED) return null
  const known = summaryOf(xs, ys)
  if (known) return known
  const n = Math.min(xs.length, ys.length)
  const levels: Level[] = []
  // the first level from the points
  let count = n >> SHIFT
  let low = new Int32Array(count)
  let high = new Int32Array(count)
  let gap = new Uint8Array(count)
  for (let b = 0; b < count; b++) {
    let lo = -1
    let hi = -1
    let broken = 0
    for (let i = b << SHIFT, end = i + BLOCK; i < end; i++) {
      const y = ys[i]!
      if (y !== y || xs[i]! !== xs[i]!) {
        broken = 1
        continue
      }
      if (lo < 0 || y < ys[lo]!) lo = i
      if (hi < 0 || y > ys[hi]!) hi = i
    }
    low[b] = lo
    high[b] = hi
    gap[b] = broken
  }
  levels.push({ size: BLOCK, low, high, gap })
  // each next level from the one under it
  while (count >= BLOCK) {
    const under = levels[levels.length - 1]!
    count >>= SHIFT
    low = new Int32Array(count)
    high = new Int32Array(count)
    gap = new Uint8Array(count)
    for (let b = 0; b < count; b++) {
      let lo = -1
      let hi = -1
      let broken = 0
      for (let k = b << SHIFT, end = k + BLOCK; k < end; k++) {
        broken |= under.gap[k]!
        const l = under.low[k]!
        const h = under.high[k]!
        if (l >= 0 && (lo < 0 || ys[l]! < ys[lo]!)) lo = l
        if (h >= 0 && (hi < 0 || ys[h]! > ys[hi]!)) hi = h
      }
      low[b] = lo
      high[b] = hi
      gap[b] = broken
    }
    levels.push({ size: under.size << SHIFT, low, high, gap })
  }
  summaries.set(ys, { xs, levels })
  return levels
}

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
  /** Whether `xs` goes up from start to end: long lines can then skip whole blocks. */
  sorted = false,
): { indices: Int32Array; length: number } {
  const levels = sorted && to - from >= SUMMARIZED ? summaryOf(xs, ys) : null
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
    // a block of points all in one column: its first, lowest, highest and last at once
    if (levels && (i & (BLOCK - 1)) === 0) {
      let taken = false
      for (let l = levels.length - 1; l >= 0 && !taken; l--) {
        const level = levels[l]!
        const size = level.size
        if (i % size !== 0 || i + size > to) continue
        const block = i / size
        if (level.gap[block]) continue
        const c = Math.floor(xs[i]! * k + b)
        if (Math.floor(xs[i + size - 1]! * k + b) !== c) continue
        const lo = level.low[block]!
        const hi = level.high[block]!
        if (c !== column) {
          flush()
          column = c
          first = i
          min = lo
          max = hi
          low = ys[lo]!
          high = ys[hi]!
        } else {
          if (ys[lo]! < low) {
            low = ys[lo]!
            min = lo
          }
          if (ys[hi]! > high) {
            high = ys[hi]!
            max = hi
          }
        }
        last = i + size - 1
        i += size - 1
        taken = true
      }
      if (taken) continue
    }
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
