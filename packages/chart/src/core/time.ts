/**
 * Ticks on a time axis, at round points of local time: whole minutes,
 * midnights, the first of a month. The step is the smallest one that
 * gives no more than the wanted number of ticks.
 */

export type TimeUnit = 'second' | 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year'

export interface TimeInterval {
  unit: TimeUnit
  every: number
}

const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

const INTERVALS: Array<[TimeUnit, number, number]> = [
  ['second', 1, SECOND],
  ['second', 5, 5 * SECOND],
  ['second', 15, 15 * SECOND],
  ['second', 30, 30 * SECOND],
  ['minute', 1, MINUTE],
  ['minute', 2, 2 * MINUTE],
  ['minute', 5, 5 * MINUTE],
  ['minute', 10, 10 * MINUTE],
  ['minute', 15, 15 * MINUTE],
  ['minute', 30, 30 * MINUTE],
  ['hour', 1, HOUR],
  ['hour', 2, 2 * HOUR],
  ['hour', 3, 3 * HOUR],
  ['hour', 6, 6 * HOUR],
  ['hour', 12, 12 * HOUR],
  ['day', 1, DAY],
  ['day', 2, 2 * DAY],
  ['week', 1, 7 * DAY],
  ['week', 2, 14 * DAY],
  ['month', 1, 30 * DAY],
  ['month', 3, 91 * DAY],
  ['month', 6, 182 * DAY],
  ['year', 1, 365 * DAY],
]

/** The smallest interval that gives at most `count` ticks across `span` ms. */
export function timeInterval(span: number, count: number): TimeInterval {
  for (const [unit, every, length] of INTERVALS) {
    if (span / length <= Math.max(1, count)) return { unit, every }
  }
  // whole years, a nice number of them
  const years = span / (365 * DAY) / Math.max(1, count)
  const power = 10 ** Math.floor(Math.log10(years))
  const fraction = years / power
  return {
    unit: 'year',
    every: (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10) * power,
  }
}

function localDay(year: number, month: number, day: number): Date {
  if (year >= 0 && year < 100) {
    const d = new Date(0)
    d.setFullYear(year, month, day)
    d.setHours(0, 0, 0, 0)
    return d
  }
  return new Date(year, month, day)
}

function utcDay(year: number, month: number, day: number): number {
  if (year >= 0 && year < 100) {
    const d = new Date(0)
    d.setUTCFullYear(year, month, day)
    d.setUTCHours(0, 0, 0, 0)
    return d.getTime()
  }
  return Date.UTC(year, month, day)
}

/** The start of the `unit` that `time` falls in (weeks start on Monday). */
export function floorTime(time: number, unit: TimeUnit): Date {
  const d = new Date(time)
  switch (unit) {
    case 'year':
      return localDay(d.getFullYear(), 0, 1)
    case 'month':
      return localDay(d.getFullYear(), d.getMonth(), 1)
    case 'week': {
      const back = (d.getDay() + 6) % 7
      return localDay(d.getFullYear(), d.getMonth(), d.getDate() - back)
    }
    case 'day':
      return localDay(d.getFullYear(), d.getMonth(), d.getDate())
    case 'hour': {
      const base = time - d.getSeconds() * SECOND - d.getMilliseconds()
      const cand = base - d.getMinutes() * MINUTE
      const offsetDelta = new Date(cand).getTimezoneOffset() - d.getTimezoneOffset()
      return new Date(offsetDelta === 0 ? cand : cand + offsetDelta * MINUTE)
    }
    case 'minute':
      return new Date(time - d.getSeconds() * SECOND - d.getMilliseconds())
    default:
      return new Date(Math.floor(time / SECOND) * SECOND)
  }
}

/** Whether `date` is on a multiple of `every` within the next unit up, so steps line up. */
function aligned(date: Date, { unit, every }: TimeInterval): boolean {
  if (every === 1) return true
  switch (unit) {
    case 'year':
      return date.getFullYear() % every === 0
    case 'month':
      return date.getMonth() % every === 0
    case 'day':
      return (date.getDate() - 1) % every === 0 && date.getDate() + every - 1 <= 31
    case 'hour':
      return date.getHours() % every === 0
    case 'minute':
      return date.getMinutes() % every === 0
    case 'second':
      return date.getSeconds() % every === 0
    case 'week': {
      // counted from a Monday long ago, so the same weeks are picked whatever is shown
      const days = Math.round(
        (utcDay(date.getFullYear(), date.getMonth(), date.getDate()) - Date.UTC(1970, 0, 5)) / DAY,
      )
      const weeks = Math.floor(days / 7)
      return ((weeks % every) + every) % every === 0
    }
    default:
      return true
  }
}

function next(date: Date, unit: TimeUnit): Date {
  switch (unit) {
    case 'year':
      return localDay(date.getFullYear() + 1, 0, 1)
    case 'month':
      return localDay(date.getFullYear(), date.getMonth() + 1, 1)
    case 'week':
      return localDay(date.getFullYear(), date.getMonth(), date.getDate() + 7)
    case 'day':
      return localDay(date.getFullYear(), date.getMonth(), date.getDate() + 1)
    case 'hour': {
      // step in epoch time so 1-hour spring/fall DST transitions don't loop or drift,
      // and snap back onto whole hours after sub-hour DST shifts (such as Australia/Lord_Howe)
      const base = date.getTime() - date.getSeconds() * SECOND - date.getMilliseconds()
      const step = date.getMinutes() > 0 ? (60 - date.getMinutes()) * MINUTE : HOUR
      const candidate = base + step
      const minutes = new Date(candidate).getMinutes()
      if (minutes === 0) return new Date(candidate)
      const back = candidate - minutes * MINUTE
      if (back > date.getTime() && new Date(back).getMinutes() === 0) return new Date(back)
      return new Date(candidate + (60 - minutes) * MINUTE)
    }
    case 'minute':
      return new Date(date.getTime() + MINUTE)
    default:
      return new Date(date.getTime() + SECOND)
  }
}

/**
 * Whether `time` falls inside a repeated local clock interval created by
 * setting the clock back (for example, the two 01:00–01:59 hours on an
 * autumn DST transition).
 */
export function isAmbiguousLocalTime(time: number): boolean {
  const offset = new Date(time).getTimezoneOffset()
  const later = new Date(time + 2 * HOUR).getTimezoneOffset()
  if (later > offset) {
    const shift = (later - offset) * MINUTE
    if (new Date(time + shift).getTimezoneOffset() === later) return true
  }
  const earlier = new Date(time - 2 * HOUR).getTimezoneOffset()
  if (earlier < offset) {
    const shift = (offset - earlier) * MINUTE
    if (new Date(time - shift).getTimezoneOffset() === earlier) return true
  }
  return false
}

/** The shortest calendar-day span (ms) adjacent to the day containing `time`. */
export function adjacentDaySpan(time: number): number {
  const d = new Date(time)
  const y = d.getFullYear()
  const m = d.getMonth()
  const day = d.getDate()
  const start = localDay(y, m, day).getTime()
  const prev = localDay(y, m, day - 1).getTime()
  const following = localDay(y, m, day + 1).getTime()
  return Math.min(start - prev, following - start)
}

/** The ticks of `interval` from `lo` to `hi` (ms), both ends included when they fall on one. */
export function timeTicks(lo: number, hi: number, interval: TimeInterval): number[] {
  const ticks: number[] = []
  if (!(hi >= lo)) return ticks
  let date = floorTime(lo, interval.unit)
  // a guard against runaway loops on absurd spans
  for (let guard = 0; guard < 10000 && date.getTime() <= hi; guard++) {
    if (date.getTime() >= lo && aligned(date, interval)) ticks.push(date.getTime())
    date = next(date, interval.unit)
  }
  return ticks
}

/** The next unit up, whose boundaries a tick label marks with more context. */
export function parentUnit(unit: TimeUnit): TimeUnit | null {
  switch (unit) {
    case 'second':
      return 'minute'
    case 'minute':
    case 'hour':
      return 'day'
    case 'day':
    case 'week':
      return 'month'
    case 'month':
      return 'year'
    default:
      return null
  }
}

/** Whether `time` is the very start of a `unit`. */
export function startsUnit(time: number, unit: TimeUnit): boolean {
  return floorTime(time, unit).getTime() === time
}
