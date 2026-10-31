/*
 * Times are minutes since 1970-01-01 00:00 on the wall clock, kept as plain
 * numbers. Time zones and daylight saving never enter: `2026-03-05 09:00`
 * is the same number wherever the chart runs. Strings are read on the way
 * in and written on the way out; everything in between is arithmetic.
 */

export const MINUTES_PER_HOUR = 60
export const MINUTES_PER_DAY = 1440

const PATTERN = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::\d{2})?)?$/

export interface ParsedTime {
  /** Minutes since the epoch. */
  at: number
  /** The string had no time of day. */
  dateOnly: boolean
}

/**
 * Reads `YYYY-MM-DD` or `YYYY-MM-DD HH:mm`; seconds (`HH:mm:ss`) are
 * accepted and dropped. `null` for anything else.
 */
export function parseTime(text: string | undefined | null): ParsedTime | null {
  const match = text ? PATTERN.exec(text.trim()) : null
  if (!match) return null
  const [, y, mo, d, h, mi] = match
  const month = Number(mo)
  const day = Number(d)
  const hour = h == null ? 0 : Number(h)
  const minute = mi == null ? 0 : Number(mi)
  if (month < 1 || month > 12 || day < 1 || hour > 23 || minute > 59) return null
  const at = fromParts(Number(y), month, day, hour, minute)
  // reject days past the end of the month, e.g. 02-30
  if (partsOf(at).day !== day) return null
  return { at, dateOnly: h == null }
}

/** Minutes since the epoch for a wall-clock date; `month` counts from 1. */
export function fromParts(year: number, month: number, day: number, hour = 0, minute = 0) {
  return Date.UTC(year, month - 1, day, hour, minute) / 60_000
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
}

export function partsOf(at: number): TimeParts {
  const date = new Date(at * 60_000)
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    weekday: date.getUTCDay(),
    hour: date.getUTCHours(),
    minute: date.getUTCMinutes(),
  }
}

const pad = (n: number) => String(n).padStart(2, '0')

/** `YYYY-MM-DD`. */
export function formatDate(at: number) {
  const p = partsOf(at)
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`
}

/** `YYYY-MM-DD HH:mm`, or `YYYY-MM-DD` when `dateOnly`. */
export function formatTime(at: number, dateOnly = false) {
  if (dateOnly) return formatDate(at)
  const p = partsOf(at)
  return `${formatDate(at)} ${pad(p.hour)}:${pad(p.minute)}`
}

/** `HH:mm` as minutes since midnight, or `null`. */
export function parseClock(text: string | undefined) {
  const match = text ? /^(\d{1,2}):(\d{2})$/.exec(text) : null
  if (!match) return null
  const minutes = Number(match[1]) * 60 + Number(match[2])
  return minutes <= MINUTES_PER_DAY ? minutes : null
}

/** The midnight that starts the day of `at`. */
export const dayStart = (at: number) => Math.floor(at / MINUTES_PER_DAY) * MINUTES_PER_DAY

/** Days since the epoch. */
export const dayIndex = (at: number) => Math.floor(at / MINUTES_PER_DAY)

export const isMidnight = (at: number) => at % MINUTES_PER_DAY === 0

/** The current wall-clock time, in minutes since the epoch. */
export function wallClockNow(now = new Date()) {
  return fromParts(
    now.getFullYear(),
    now.getMonth() + 1,
    now.getDate(),
    now.getHours(),
    now.getMinutes(),
  )
}
