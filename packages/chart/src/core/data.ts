import { toRaw } from 'vue'
import { inOrder } from './hit'

/** A row of chart data: usually an object, read through accessors. */
export type ChartRow = any

/**
 * Data given by column instead of by row: a list of values for each key,
 * all as long as each other. Typed arrays (`Float64Array`) are read
 * fastest; a key reads its column, a function gets a row put together
 * from all the columns.
 */
export type ChartColumns = Readonly<Record<string, ArrayLike<unknown>>>

/** Data as rows (objects), or as columns. */
export type ChartData = readonly ChartRow[] | ChartColumns

/** Whether `data` is given by column. */
export const byColumn = (data: ChartData): data is ChartColumns => !Array.isArray(data)

/** How many rows `data` has: the length of its first column, when by column. */
export function rowCount(data: ChartData): number {
  if (!byColumn(data)) return data.length
  for (const key in data) return data[key]!.length
  return 0
}

const columnRows = new WeakMap<ChartColumns, Map<number, Record<string, unknown>>>()

/**
 * Row `i` of `data`. A row of columns is put together when first asked
 * for, and is then the same object each time.
 */
export function rowOf(data: ChartData, i: number): ChartRow {
  if (!byColumn(data)) return data[i]
  let made = columnRows.get(data)
  if (!made) columnRows.set(data, (made = new Map()))
  let row = made.get(i)
  if (!row) {
    row = {}
    for (const key in data) row[key] = data[key]![i]
    made.set(i, row)
  }
  return row
}

/**
 * Picks a value from a row: a key of the row, or a function of the row and
 * its index. Prefer keys for large data: a function written inline in the
 * template is new on every render, so its column can't be cached.
 */
export type ChartAccessor<V = unknown> = string | ((row: ChartRow, index: number) => V)

/** How x values are read: numbers, points in time (ms), or categories. */
export type XKind = 'linear' | 'time' | 'category'

export interface XColumn {
  kind: XKind
  /** Numbers, times in ms, or the index of each row's category in `categories`. */
  values: Float64Array
  /** For `category`: the categories in the order they first appear. */
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

/** Places rows by their index when there is no x. */
export const byIndex: ChartAccessor = (_row, index) => index

/** Guesses how x values are meant from the first one that is there. */
export function inferXKind(rows: ChartData, accessor: ChartAccessor): XKind {
  const column = byColumn(rows) && typeof accessor === 'string' ? rows[accessor] : null
  for (let i = 0, n = rowCount(rows); i < n; i++) {
    const value = column ? column[i] : read(rowOf(rows, i), accessor, i)
    if (value == null || value === '') continue
    if (typeof value === 'number') return 'linear'
    if (value instanceof Date) return 'time'
    if (typeof value === 'string' && DATE.test(value.trim())) return 'time'
    return 'category'
  }
  return 'linear'
}

/* columns, cached per data array and accessor */

const cache = new WeakMap<object, Map<string, Map<unknown, unknown>>>()

/*
 * Live data comes as a new array each time: the last one with a few rows
 * added at the end, and perhaps a few gone from the start. The column of
 * the last array is then moved along and only the new rows are read.
 */

/** The last array a column was built from, for each scope and key. */
const latest = new Map<string, { rows: WeakRef<readonly ChartRow[]>; value: unknown }>()
/** At most this many rows gone from the start, for the rest to be kept. */
const MOST_DROPPED = 4096

/**
 * How `rows` carries on from `before`: how many rows of `before` are gone
 * from its start (`dropped`) and how many are kept (`kept`, the start of
 * `rows`). `null` when it doesn't carry on from it.
 */
export function carriesOn(
  rows: readonly ChartRow[],
  before: readonly ChartRow[],
): { dropped: number; kept: number } | null {
  if (!rows.length || !before.length) return null
  const first = rows[0]
  let dropped = -1
  for (let i = 0, most = Math.min(before.length, MOST_DROPPED); i < most; i++) {
    if (before[i] === first) {
      dropped = i
      break
    }
  }
  if (dropped < 0) return null
  const kept = before.length - dropped
  // nothing new: the rows may have been changed in place, so read them all
  if (kept >= rows.length) return null
  // the same rows at the end and in the middle: taken as the same throughout
  if (rows[kept - 1] !== before[before.length - 1]) return null
  if (rows[kept >> 1] !== before[dropped + (kept >> 1)]) return null
  return { dropped, kept }
}

function cached<T>(
  rows: ChartData,
  scope: string,
  key: unknown,
  build: () => T,
  /** Builds it from the column of the array `rows` carries on from. */
  extend?: (before: T, dropped: number, kept: number) => T | null,
): T {
  let scopes = cache.get(rows)
  if (!scopes) cache.set(rows, (scopes = new Map()))
  let entries = scopes.get(scope)
  if (!entries) scopes.set(scope, (entries = new Map()))
  if (entries.has(key)) return entries.get(key) as T
  // only keys read the same row the same wherever it is: a function also gets the index
  const name = typeof key === 'string' ? `${scope}\u0000${key}` : null
  let value: T | null = null
  // live data comes as rows
  const live = name && extend && !byColumn(rows)
  if (live) {
    const last = latest.get(name)
    const before = last?.rows.deref()
    const link = before && carriesOn(rows, before)
    if (link) value = extend(last!.value as T, link.dropped, link.kept)
  }
  value ??= build()
  entries.set(key, value)
  if (live && typeof WeakRef === 'function') latest.set(name, { rows: new WeakRef(rows), value })
  return value
}

/*
 * Reading columns: the loops below run once per row of data that may have
 * a million rows, so they read a key straight off the row and take a
 * number as it is without a call. Rows of a raw array are raw themselves,
 * so they aren't unwrapped one by one.
 */

type Numbers =
  | Float64Array
  | Float32Array
  | Int32Array
  | Uint32Array
  | Int16Array
  | Uint16Array
  | Int8Array
  | Uint8Array

/** Whether a column is a typed array of numbers, which can be copied at once. */
const isNumbers = (column: unknown): column is Numbers =>
  ArrayBuffer.isView(column) &&
  !(column instanceof DataView) &&
  !(column instanceof BigInt64Array) &&
  !(column instanceof BigUint64Array)

/** A value that isn't a number, read as one: `NaN` for none. */
function slowNumber(value: unknown): number {
  return value == null || value === '' ? Number.NaN : Number(value)
}

/** Reads the x of each row from `from` on into `values`, as numbers or times (not categories). */
function readX(
  rows: ChartData,
  accessor: ChartAccessor,
  time: boolean,
  from: number,
  values: Float64Array,
) {
  if (accessor === byIndex) {
    for (let i = from; i < values.length; i++) values[i] = i
    return
  }
  if (byColumn(rows)) {
    const column = typeof accessor === 'string' ? (toRaw(rows[accessor]) ?? []) : null
    // numbers already: copied at once
    if (from === 0 && isNumbers(column)) return values.set(column.subarray(0, values.length))
    for (let i = from, n = values.length; i < n; i++) {
      const value = column ? column[i] : read(rowOf(rows, i), accessor, i)
      values[i] = typeof value === 'number' ? value : time ? toTime(value) : slowNumber(value)
    }
    return
  }
  const key = typeof accessor === 'string' ? accessor : null
  for (let i = from; i < rows.length; i++) {
    const row = rows[i]
    const value = key === null ? read(row, accessor, i) : row == null ? undefined : row[key]
    values[i] = typeof value === 'number' ? value : time ? toTime(value) : slowNumber(value)
  }
}

/** Reads the y of each row from `from` on into `values`; anything not finite is `NaN`. */
function readY(rows: ChartData, accessor: ChartAccessor, from: number, values: Float64Array) {
  if (byColumn(rows)) {
    const column = typeof accessor === 'string' ? (toRaw(rows[accessor]) ?? []) : null
    if (from === 0 && isNumbers(column)) {
      values.set(column.subarray(0, values.length))
      for (let i = 0; i < values.length; i++) {
        const v = values[i]!
        if (v - v !== 0) values[i] = Number.NaN
      }
      return
    }
    for (let i = from, n = values.length; i < n; i++) {
      const value = column ? column[i] : read(rowOf(rows, i), accessor, i)
      const v = typeof value === 'number' ? value : slowNumber(value)
      values[i] = v - v === 0 ? v : Number.NaN
    }
    return
  }
  const key = typeof accessor === 'string' ? accessor : null
  for (let i = from; i < rows.length; i++) {
    const row = rows[i]
    const value = key === null ? read(row, accessor, i) : row == null ? undefined : row[key]
    const n = typeof value === 'number' ? value : slowNumber(value)
    // `n - n` is 0 only for finite numbers
    values[i] = n - n === 0 ? n : Number.NaN
  }
}

/** X columns with a gap somewhere. */
const gapped = new WeakSet<Float64Array>()

/**
 * The x values of `rows` as one typed array. Built once per data array,
 * accessor and kind: replace the array (don't change it in place) for the
 * chart to see new data.
 */
export function xColumn(rows: ChartData, accessor: ChartAccessor, kind: XKind): XColumn {
  const raw = toRaw(rows)
  return cached(
    raw,
    `x:${kind}`,
    accessor,
    () => buildX(raw, accessor, kind),
    (before, dropped, kept) => {
      // categories and gaps of the dropped rows would linger: built afresh
      if (kind === 'category' || !before.sorted || gapped.has(before.values)) return null
      const values = new Float64Array(rowCount(raw))
      values.set(before.values.subarray(dropped))
      readX(raw, accessor, kind === 'time', kept, values)
      // out of order or missing: built afresh, which works out the rest
      for (let i = kept; i < values.length; i++) if (!(values[i]! >= values[i - 1]!)) return null
      inOrder(values)
      return { kind, values, categories: before.categories, sorted: true }
    },
  )
}

function buildX(rows: ChartData, accessor: ChartAccessor, kind: XKind): XColumn {
  const values = new Float64Array(rowCount(rows))
  const categories: string[] = []
  if (kind === 'category') {
    const seen = new Map<string, number>()
    const column = byColumn(rows) && typeof accessor === 'string' ? rows[accessor] : null
    for (let i = 0; i < values.length; i++) {
      const value = column ? column[i] : read(rowOf(rows, i), accessor, i)
      const label = value == null ? '' : String(value)
      let at = seen.get(label)
      if (at === undefined) seen.set(label, (at = categories.push(label) - 1))
      values[i] = at
    }
  } else readX(rows, accessor, kind === 'time', 0, values)
  let sorted = true
  let gaps = false
  let last = -Infinity
  for (let i = 0; i < values.length; i++) {
    const n = values[i]!
    if (n < last) sorted = false
    if (n === n) last = n
    else gaps = true
  }
  // the order hovering needs is then just as the rows come
  if (sorted && !gaps) inOrder(values)
  if (gaps) gapped.add(values)
  return { kind, values, categories, sorted }
}

/**
 * The y values of `rows` as one typed array; anything that isn't a finite
 * number (`null`, a gap) is `NaN`.
 */
export function yColumn(rows: ChartData, accessor: ChartAccessor): Float64Array {
  const raw = toRaw(rows)
  return cached(
    raw,
    'y',
    accessor,
    () => {
      const values = new Float64Array(rowCount(raw))
      readY(raw, accessor, 0, values)
      return values
    },
    (before, dropped, kept) => {
      const values = new Float64Array(rowCount(raw))
      values.set(before.subarray(dropped))
      readY(raw, accessor, kept, values)
      return values
    },
  )
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
