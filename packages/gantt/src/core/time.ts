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

export interface ParsedTime {
  /** Minutes since the epoch (may be fractional for sub-minute precision). */
  at: number
  /** The input was a date string without a time of day. */
  dateOnly: boolean
}

/** Strings already read: a plan repeats the same dates, and reads them all on every change. */
const parsed = new Map<string, Readonly<ParsedTime> | null>()
const PARSED_MAX = 50_000

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

function readTime(text: string): ParsedTime | null {
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
  const wall = fromParts(year, month, day, hour, minute, second, millisecond)
  // reject days past the end of the month, e.g. 02-30
  if (partsOf(wall).day !== day) return null
  if (tz) {
    const offset = parseOffset(tz)
    if (offset == null) return null
    const utcMs =
      Date.UTC(year, month - 1, day, hour, minute, second, millisecond) - offset * MS_PER_MINUTE
    return { at: wallClockNow(new Date(utcMs)), dateOnly: false }
  }
  return { at: wall, dateOnly: h == null }
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
  return Date.UTC(year, month - 1, day, hour, minute, second, millisecond) / MS_PER_MINUTE
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

/** `YYYY-MM-DD`. */
export function formatDate(at: number) {
  const p = partsOf(at)
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`
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

/** Converts a wall-clock time (in minutes since the epoch) to a local Unix timestamp in ms. */
export function toTimestamp(at: number) {
  const p = partsOf(at)
  return new Date(p.year, p.month - 1, p.day, p.hour, p.minute, p.second, p.millisecond).getTime()
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
