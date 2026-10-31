import { toRaw } from 'vue'

/** A row of chart data: usually an object, read through accessors. */
export type ChartRow = any

/**
 * Picks a value from a row: a key of the row, or a function of the row and
 * its index. Prefer keys for large data: a function written inline in the
 * template is new on every render, so its column can't be cached.
 */
export type ChartAccessor<V = unknown> = string | ((row: ChartRow, index: number) => V)

/** How x values are read: numbers, points in time (ms), or categories. */
export type XKind = 'linear' | 'time' | 'band'

export interface XColumn {
  kind: XKind
  /** Numbers, times in ms, or the index of each row's category in `categories`. */
  values: Float64Array
  /** For `band`: the categories in the order they first appear. */
  categories: string[]
  /** Whether `values` never go down, so the visible part can be found by bisection. */
  sorted: boolean
}

const DATE = /^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?(?:[ T](\d{1,2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?)?$/

/**
 * A point in time in ms, or `NaN`. Dates without a zone (`'2026-10-31'`,
 * `'2026-10-31 09:30'`) are read in local time, the way people write them.
 */
export function toTime(value: unknown): number {
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'number') return value
  if (typeof value !== 'string') return Number.NaN
  const match = DATE.exec(value.trim())
  if (match) {
    const [, y, mo, d, h, mi, s, ms] = match
    return new Date(
      Number(y),
      Number(mo) - 1,
      d ? Number(d) : 1,
      h ? Number(h) : 0,
      mi ? Number(mi) : 0,
      s ? Number(s) : 0,
      ms ? Number(ms.slice(0, 3).padEnd(3, '0')) : 0,
    ).getTime()
  }
  return Date.parse(value)
}

/** Reads `accessor` from `row`. */
export function read(row: ChartRow, accessor: ChartAccessor, index: number): unknown {
  if (typeof accessor === 'function') return accessor(row, index)
  return row == null ? undefined : (row as Record<string, unknown>)[accessor]
}

/** Guesses how x values are meant from the first one that is there. */
export function inferXKind(rows: readonly ChartRow[], accessor: ChartAccessor): XKind {
  for (let i = 0; i < rows.length; i++) {
    const value = read(rows[i], accessor, i)
    if (value == null || value === '') continue
    if (typeof value === 'number') return 'linear'
    if (value instanceof Date) return 'time'
    if (typeof value === 'string' && DATE.test(value.trim())) return 'time'
    return 'band'
  }
  return 'linear'
}

/* columns, cached per data array and accessor */

const cache = new WeakMap<object, Map<string, Map<unknown, unknown>>>()

function cached<T>(rows: readonly ChartRow[], scope: string, key: unknown, build: () => T): T {
  let scopes = cache.get(rows)
  if (!scopes) cache.set(rows, (scopes = new Map()))
  let entries = scopes.get(scope)
  if (!entries) scopes.set(scope, (entries = new Map()))
  if (entries.has(key)) return entries.get(key) as T
  const value = build()
  entries.set(key, value)
  return value
}

/**
 * The x values of `rows` as one typed array. Built once per data array,
 * accessor and kind: replace the array (don't change it in place) for the
 * chart to see new data.
 */
export function xColumn(rows: readonly ChartRow[], accessor: ChartAccessor, kind: XKind): XColumn {
  const raw = toRaw(rows)
  return cached(raw, `x:${kind}`, accessor, () => buildX(raw, accessor, kind))
}

function buildX(rows: readonly ChartRow[], accessor: ChartAccessor, kind: XKind): XColumn {
  const values = new Float64Array(rows.length)
  const categories: string[] = []
  const seen = new Map<string, number>()
  let sorted = true
  let last = -Infinity
  for (let i = 0; i < rows.length; i++) {
    const value = read(toRaw(rows[i]), accessor, i)
    let n: number
    if (kind === 'band') {
      const label = value == null ? '' : String(value)
      let at = seen.get(label)
      if (at === undefined) seen.set(label, (at = categories.push(label) - 1))
      n = at
    } else if (kind === 'time') n = toTime(value)
    else
      n =
        typeof value === 'number'
          ? value
          : value == null || value === ''
            ? Number.NaN
            : Number(value)
    values[i] = n
    if (n < last) sorted = false
    if (n === n) last = n
  }
  return { kind, values, categories, sorted }
}

/**
 * The y values of `rows` as one typed array; anything that isn't a finite
 * number (`null`, a gap) is `NaN`.
 */
export function yColumn(rows: readonly ChartRow[], accessor: ChartAccessor): Float64Array {
  const raw = toRaw(rows)
  return cached(raw, 'y', accessor, () => {
    const values = new Float64Array(raw.length)
    for (let i = 0; i < raw.length; i++) {
      const value = read(toRaw(raw[i]), accessor, i)
      const n =
        typeof value === 'number'
          ? value
          : value == null || value === ''
            ? Number.NaN
            : Number(value)
      values[i] = Number.isFinite(n) ? n : Number.NaN
    }
    return values
  })
}

/** The smallest and largest number in `values` (skipping `NaN`), or `null`. */
export function extent(
  values: ArrayLike<number>,
  from = 0,
  to = values.length,
): [number, number] | null {
  let min = Infinity
  let max = -Infinity
  for (let i = from; i < to; i++) {
    const v = values[i]!
    if (v < min) min = v
    if (v > max) max = v
  }
  return min <= max ? [min, max] : null
}

/** The first index whose value is `>= target`, in a sorted array (`NaN`s aside). */
export function bisect(
  values: ArrayLike<number>,
  target: number,
  lo = 0,
  hi = values.length,
): number {
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (values[mid]! < target) lo = mid + 1
    else hi = mid
  }
  return lo
}
