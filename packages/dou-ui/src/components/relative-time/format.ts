import type { RelativeTimeValue } from './relative-time'

const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** Largest first. Months and years are averages: close enough for "3 months ago". */
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * DAY],
  ['month', 30 * DAY],
  ['week', 7 * DAY],
  ['day', DAY],
  ['hour', HOUR],
  ['minute', MINUTE],
]

/** Below this, the moment is "just now". */
export const JUST_NOW = 45 * SECOND

const LOCAL_DATE =
  /^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?(?:[ T](\d{1,2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?)?$/
const ZONED_DATE =
  /^\d{4}-\d{1,2}-\d{1,2}[ T]\d{1,2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:[Zz]|[+-]\d{2}:?\d{2})$/

function daysInMonth(year: number, month: number): number {
  const date = new Date(0)
  date.setUTCFullYear(year, month, 0)
  return date.getUTCDate()
}

export function toTime(value: RelativeTimeValue): number {
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'number') return value
  const trimmed = value.trim()
  const match = LOCAL_DATE.exec(trimmed)
  if (match) {
    const [, y, mo, d, h, mi, s, ms] = match
    const year = Number(y)
    const month = Number(mo)
    const day = d ? Number(d) : 1
    const hour = h ? Number(h) : 0
    const minute = mi ? Number(mi) : 0
    const second = s ? Number(s) : 0
    const millis = ms ? Number(ms.slice(0, 3).padEnd(3, '0')) : 0
    if (
      month < 1 ||
      month > 12 ||
      day < 1 ||
      day > daysInMonth(year, month) ||
      hour > 23 ||
      minute > 59 ||
      second > 59
    )
      return Number.NaN
    if (year < 100) {
      const date = new Date(0)
      date.setFullYear(year, month - 1, day)
      date.setHours(hour, minute, second, millis)
      return date.getTime()
    }
    return new Date(year, month - 1, day, hour, minute, second, millis).getTime()
  }
  if (ZONED_DATE.test(trimmed)) return new Date(trimmed.replace(' ', 'T')).getTime()
  return new Date(value).getTime()
}

/**
 * The unit and count that describe `diff` (ms, negative for the past),
 * or `null` for "just now". Counts are whole units, rounded toward zero,
 * so a moment 59 minutes ago is "59 minutes ago", not "1 hour ago".
 */
export function relativeUnit(
  diff: number,
): { unit: Intl.RelativeTimeFormatUnit; count: number; size: number } | null {
  const distance = Math.abs(diff)
  if (distance < JUST_NOW) return null
  const [unit, size] = UNITS.find(([, length]) => distance >= length) ?? UNITS[UNITS.length - 1]!
  const count = Math.max(1, Math.floor(distance / size))
  return { unit, count: diff < 0 ? -count : count, size }
}

/** How long until the text for `diff` changes, in ms. */
export function nextChange(diff: number): number {
  const distance = Math.abs(diff)
  const part = relativeUnit(diff)
  // past moments move away from now, future ones toward it
  const edge = part
    ? diff < 0
      ? (Math.abs(part.count) + 1) * part.size
      : Math.abs(part.count) * part.size
    : JUST_NOW
  const wait = diff < 0 || !part ? edge - distance : distance - edge + 1
  return Math.max(wait, SECOND)
}

const formatters = new Map<string, Intl.RelativeTimeFormat>()

export function relativeFormatter(
  locale: string,
  numeric: 'auto' | 'always',
  short: boolean,
): Intl.RelativeTimeFormat {
  const key = `${locale}|${numeric}|${short}`
  let formatter = formatters.get(key)
  if (!formatter) {
    formatter = new Intl.RelativeTimeFormat(locale, { numeric, style: short ? 'short' : 'long' })
    formatters.set(key, formatter)
  }
  return formatter
}

const pad = (value: number) => String(value).padStart(2, '0')

/** Show a moment through a pattern such as `YYYY-MM-DD HH:mm`. */
export function formatMoment(
  time: number,
  pattern: string,
  meridiem: { am: string; pm: string },
): string {
  const date = new Date(time)
  const hours = date.getHours()
  const tokens: Record<string, string> = {
    YYYY: String(date.getFullYear()).padStart(4, '0'),
    MM: pad(date.getMonth() + 1),
    DD: pad(date.getDate()),
    HH: pad(hours),
    hh: pad(hours % 12 || 12),
    mm: pad(date.getMinutes()),
    ss: pad(date.getSeconds()),
    A: hours < 12 ? meridiem.am : meridiem.pm,
  }
  return pattern.replace(
    /\[([^\]]*)\]|YYYY|MM|DD|HH|hh|mm|ss|A/g,
    (match, literal?: string) => literal ?? tokens[match]!,
  )
}
