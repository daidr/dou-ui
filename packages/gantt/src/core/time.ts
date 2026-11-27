/*
 * Times are minutes since 1970-01-01 00:00 on the wall clock, kept as plain
 * numbers (including fractional seconds and milliseconds). Strings without an
 * offset are read on the wall clock so time zones and daylight saving never
 * shift them; numeric Unix timestamps (ms) and ISO strings with an offset are
 * projected onto the local wall clock so they align with the current-time line.
 */

export const MINUTES_PER_HOUR = 60
export const MINUTES_PER_DAY = 1440
const MS_PER_MINUTE = 60_000
const MS_PER_DAY = MINUTES_PER_DAY * MS_PER_MINUTE

/** A date/time string (`YYYY-MM-DD`, `YYYY-MM-DD HH:mm:ss(.SSS)`, ISO 8601) or Unix timestamp in ms. */
export type GanttTime = string | number

const PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(Z|[+-]\d{2}:?\d{2})?)?$/i

/** Matches strings ending with an explicit ISO-8601 timezone offset (`Z` or `±HH:mm`/`±HHmm`). */
const HAS_OFFSET = /(?:[zZ]|[+-]\d{2}:?\d{2})\s*$/

export interface ParsedTime {
  /** Minutes since the epoch (may be fractional for sub-minute precision). */
  at: number
  /** The input was a date string without a time of day. */
  dateOnly: boolean
}

/** Strings already read: a plan repeats the same dates, and reads them all on every change. */
const parsed = new Map<string, Readonly<ParsedTime> | null>()
const PARSED_MAX = 50_000

function utcMsOf(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  millisecond = 0,
) {
  if (year >= 0 && year < 100) {
    const date = new Date(0)
    date.setUTCFullYear(year, month - 1, day)
    date.setUTCHours(hour, minute, second, millisecond)
    return date.getTime()
  }
  return Date.UTC(year, month - 1, day, hour, minute, second, millisecond)
}

function localDate(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  millisecond = 0,
) {
  if (year >= 0 && year < 100) {
    const date = new Date(0)
    date.setFullYear(year, month - 1, day)
    date.setHours(hour, minute, second, millisecond)
    return date
  }
  return new Date(year, month - 1, day, hour, minute, second, millisecond)
}

function wallMsOf(ms: number) {
  const date = new Date(ms)
  return utcMsOf(
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate(),
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
    date.getMilliseconds(),
  )
}

/**
 * Reads `YYYY-MM-DD`, `YYYY-MM-DD HH:mm`, `YYYY-MM-DD HH:mm:ss(.SSS)`,
 * ISO-8601 strings with a timezone offset, or Unix timestamps in milliseconds.
 * Returns `null` for anything else.
 */
export function parseTime(value: GanttTime | undefined | null): Readonly<ParsedTime> | null {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return null
    return { at: wallClockNow(date), dateOnly: false }
  }
  if (!value) return null
  // strings with an explicit timezone offset project onto the current local zone, so don't cache them globally
  if (HAS_OFFSET.test(value)) return readTime(value)
  let result = parsed.get(value)
  if (result !== undefined) return result
  result = readTime(value)
  if (parsed.size >= PARSED_MAX) parsed.clear()
  parsed.set(value, result)
  return result
}

function parseOffset(tz: string): number | null {
  if (tz === 'Z' || tz === 'z') return 0
  const sign = tz[0] === '-' ? -1 : 1
  const raw = tz.slice(1).replace(':', '')
  const hours = Number(raw.slice(0, 2))
  const minutes = Number(raw.slice(2, 4))
  if (hours > 23 || minutes > 59) return null
  return sign * (hours * 60 + minutes)
}

function readParts(text: string) {
  const match = PATTERN.exec(text.trim())
  if (!match) return null
  const [, y, mo, d, h, mi, s, frac, tz] = match
  const year = Number(y)
  const month = Number(mo)
  const day = Number(d)
  const hour = h == null ? 0 : Number(h)
  const minute = mi == null ? 0 : Number(mi)
  const second = s == null ? 0 : Number(s)
  const millisecond = frac == null ? 0 : Number(frac.slice(0, 3).padEnd(3, '0'))
  if (month < 1 || month > 12 || day < 1 || hour > 23 || minute > 59 || second > 59) return null
  const wallMs = utcMsOf(year, month, day, hour, minute, second, millisecond)
  const wall = wallMs / MS_PER_MINUTE
  // reject days past the end of the month, e.g. 02-30
  if (partsOf(wall).day !== day) return null
  if (tz) {
    const offset = parseOffset(tz)
    if (offset == null) return null
    return { wall, dateOnly: false, utcMs: wallMs - offset * MS_PER_MINUTE }
  }
  return { wall, dateOnly: h == null, utcMs: null }
}

function readTime(text: string): ParsedTime | null {
  const parts = readParts(text)
  if (!parts) return null
  if (parts.utcMs != null) return { at: wallClockNow(new Date(parts.utcMs)), dateOnly: false }
  return { at: parts.wall, dateOnly: parts.dateOnly }
}

/**
 * Exact UTC timestamp in ms when `value` carries an instant (a numeric Unix
 * timestamp or an ISO-8601 string with an explicit timezone offset), or `null`
 * for naive wall-clock strings and invalid inputs.
 */
export function instantOf(value: GanttTime | undefined | null): number | null {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : value
  }
  if (!value || !HAS_OFFSET.test(value)) return null
  return readParts(value)?.utcMs ?? null
}

/** Minutes since the epoch for a wall-clock date; `month` counts from 1. */
export function fromParts(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  millisecond = 0,
) {
  return utcMsOf(year, month, day, hour, minute, second, millisecond) / MS_PER_MINUTE
}

export interface TimeParts {
  year: number
  /** From 1. */
  month: number
  day: number
  /** `0` is Sunday. */
  weekday: number
  hour: number
  minute: number
  second: number
  millisecond: number
}

export function partsOf(at: number): TimeParts {
  const date = new Date(Math.round(at * MS_PER_MINUTE))
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    weekday: date.getUTCDay(),
    hour: date.getUTCHours(),
    minute: date.getUTCMinutes(),
    second: date.getUTCSeconds(),
    millisecond: date.getUTCMilliseconds(),
  }
}

const pad = (n: number) => String(n).padStart(2, '0')
const pad3 = (n: number) => String(n).padStart(3, '0')
const padYear = (year: number) =>
  year < 0 ? `-${String(-year).padStart(4, '0')}` : String(year).padStart(4, '0')

/** `YYYY-MM-DD`. */
export function formatDate(at: number) {
  const p = partsOf(at)
  return `${padYear(p.year)}-${pad(p.month)}-${pad(p.day)}`
}

/**
 * `YYYY-MM-DD HH:mm` (adding `:ss` and `.SSS` when non-zero), or `YYYY-MM-DD`
 * when `dateOnly`.
 */
export function formatTime(at: number, dateOnly = false) {
  if (dateOnly) return formatDate(at)
  const p = partsOf(at)
  const base = `${formatDate(at)} ${pad(p.hour)}:${pad(p.minute)}`
  if (p.millisecond !== 0) return `${base}:${pad(p.second)}.${pad3(p.millisecond)}`
  if (p.second !== 0) return `${base}:${pad(p.second)}`
  return base
}

/**
 * Converts a wall-clock time (in minutes since the epoch) to a local Unix
 * timestamp in ms. Non-existent local times inside a DST spring-forward gap
 * clamp monotonically to the exact transition instant.
 */
export function toTimestamp(at: number) {
  const p = partsOf(at)
  const date = localDate(p.year, p.month, p.day, p.hour, p.minute, p.second, p.millisecond)
  const ms = date.getTime()
  if (Number.isNaN(ms)) return ms
  if (
    date.getFullYear() !== p.year ||
    date.getMonth() + 1 !== p.month ||
    date.getDate() !== p.day ||
    date.getHours() !== p.hour ||
    date.getMinutes() !== p.minute ||
    date.getSeconds() !== p.second ||
    date.getMilliseconds() !== p.millisecond
  ) {
    const targetWall = Math.round(at * MS_PER_MINUTE)
    let lo = ms
    let hi = ms
    const STEP = 4 * 3_600_000
    for (let i = 0; i < 8 && wallMsOf(lo) >= targetWall; i++) lo -= STEP
    for (let i = 0; i < 8 && wallMsOf(hi) < targetWall; i++) hi += STEP
    if (wallMsOf(lo) < targetWall && wallMsOf(hi) >= targetWall) {
      while (lo < hi) {
        const mid = lo + Math.floor((hi - lo) / 2)
        if (wallMsOf(mid) < targetWall) lo = mid + 1
        else hi = mid
      }
      return lo
    }
  }
  return ms
}

/** `HH:mm` as minutes since midnight, or `null`. */
export function parseClock(text: string | undefined) {
  const match = text ? /^(\d{1,2}):(\d{2})$/.exec(text) : null
  if (!match) return null
  const minutes = Number(match[1]) * 60 + Number(match[2])
  return minutes <= MINUTES_PER_DAY ? minutes : null
}

/** Days since the epoch. */
export const dayIndex = (at: number) => Math.floor(Math.round(at * MS_PER_MINUTE) / MS_PER_DAY)

/** The midnight that starts the day of `at`. */
export const dayStart = (at: number) => dayIndex(at) * MINUTES_PER_DAY

export const isMidnight = (at: number) => Math.round(at * MS_PER_MINUTE) % MS_PER_DAY === 0

/** The current wall-clock time, in minutes since the epoch. */
export function wallClockNow(now = new Date()) {
  return fromParts(
    now.getFullYear(),
    now.getMonth() + 1,
    now.getDate(),
    now.getHours(),
    now.getMinutes(),
    now.getSeconds(),
    now.getMilliseconds(),
  )
}
