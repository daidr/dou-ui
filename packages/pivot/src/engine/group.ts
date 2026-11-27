/**
 * How a field's values are put in groups: dates by a period, numbers in
 * ranges of `step` (starting at `start`, 0 by default).
 */
export type PivotGroupBy =
  'year' | 'quarter' | 'month' | 'week' | 'day' | { step: number; start?: number }

/** The periods a date can be grouped by. */
export const DATE_PERIODS = ['year', 'quarter', 'month', 'week', 'day'] as const
export type PivotDatePeriod = (typeof DATE_PERIODS)[number]

/** A name for a grouping, to cache the grouped field under. */
export function groupKey(by: PivotGroupBy | undefined): string {
  if (by === undefined) return ''
  if (typeof by === 'string') return by
  return `step:${by.step}:${by.start ?? 0}`
}

const pad = (n: number, width = 2) => String(n).padStart(width, '0')

const LOCAL_DATE =
  /^(\d{4})-(\d{1,2})(?:-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?)?)?$/
const ZONED_DATE =
  /^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?(?:([Zz])|([+-])(\d{2}):?(\d{2}))$/
const YEAR_MONTH_TIME = /^\d{4}-\d{1,2}[ T]\d{1,2}:\d{2}/

function utcDate(year: number, month: number, day: number): Date {
  const value = new Date(Date.UTC(2000, month, day))
  value.setUTCFullYear(year)
  return value
}

function localDate(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  ms = 0,
): Date {
  if (year >= 0 && year < 100) {
    const value = new Date(0)
    value.setFullYear(year, month, day)
    value.setHours(hour, minute, second, ms)
    return value
  }
  return new Date(year, month, day, hour, minute, second, ms)
}

function daysInMonth(year: number, month: number): number {
  const value = new Date(0)
  value.setUTCFullYear(year, month, 0)
  return value.getUTCDate()
}

function parseZonedDate(match: RegExpExecArray): Date | null {
  const [, y, mo, d, h, mi, s, ms, z, sign, oh, om] = match
  const year = Number(y)
  const month = Number(mo)
  const day = Number(d)
  const hour = Number(h)
  const minute = Number(mi)
  const second = s ? Number(s) : 0
  const millis = ms ? Number(ms.slice(0, 3).padEnd(3, '0')) : 0
  const offHour = z ? 0 : Number(oh)
  const offMin = z ? 0 : Number(om)
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth(year, month) ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    offHour > 23 ||
    offMin > 59
  )
    return null
  const date = new Date(0)
  date.setUTCFullYear(year, month - 1, day)
  date.setUTCHours(hour, minute, second, millis)
  const offset = z ? 0 : (sign === '+' ? 1 : -1) * (offHour * 60 + offMin)
  return new Date(date.getTime() - offset * 60_000)
}

/**
 * A date out of a value: a `Date`, a time in ms, or text such as
 * `'2026-03-15'`, `'2026-03'`, or `'2026-03-15 09:30'` (read in local time,
 * like the other parts of a day).
 */
export function toDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  if (typeof value === 'number') return Number.isFinite(value) ? new Date(value) : null
  if (typeof value === 'string') {
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
        return null
      return localDate(year, month - 1, day, hour, minute, second, millis)
    }
    const zoned = ZONED_DATE.exec(trimmed)
    if (zoned) return parseZonedDate(zoned)
    if (YEAR_MONTH_TIME.test(trimmed)) return null
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
  }
  return null
}

/** The ISO week a day is in, and the year that week belongs to. */
export function isoWeek(date: Date): [year: number, week: number] {
  const day = utcDate(date.getFullYear(), date.getMonth(), date.getDate())
  // the Thursday of the same week decides the year
  const weekday = (day.getUTCDay() + 6) % 7
  day.setUTCDate(day.getUTCDate() - weekday + 3)
  const year = day.getUTCFullYear()
  const first = utcDate(year, 0, 4)
  const firstThursday = utcDate(year, 0, 4 - ((first.getUTCDay() + 6) % 7) + 3)
  const week = 1 + Math.round((day.getTime() - firstThursday.getTime()) / 604_800_000)
  return [year, week]
}

/**
 * The group a value falls in: plain data that sorts in order and can be
 * saved in the config (filters, collapsed groups): a year is a number
 * (`2026`); a quarter, month, week or day is text (`'2026-Q1'`,
 * `'2026-03'`, `'2026-W12'`, `'2026-03-15'`); a range is its lowest
 * number. `null` when the value has no group (empty, or not a date / number).
 */
export function bucketer(by: PivotGroupBy): (value: unknown) => number | string | null {
  if (typeof by === 'object') {
    const step = by.step > 0 ? by.step : 1
    const start = by.start ?? 0
    return (value) => {
      const n = typeof value === 'number' ? value : value instanceof Date ? value.getTime() : NaN
      if (!Number.isFinite(n)) return null
      // rounded so 0.1 steps do not come out as 0.30000000000000004
      return +(Math.floor((n - start) / step) * step + start).toPrecision(12)
    }
  }
  return (value) => {
    const date = toDate(value)
    if (!date) return null
    const year = date.getFullYear()
    switch (by) {
      case 'year':
        return year
      case 'quarter':
        return `${pad(year, 4)}-Q${Math.floor(date.getMonth() / 3) + 1}`
      case 'month':
        return `${pad(year, 4)}-${pad(date.getMonth() + 1)}`
      case 'week': {
        const [y, w] = isoWeek(date)
        return `${pad(y, 4)}-W${pad(w)}`
      }
      default:
        return `${pad(year, 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    }
  }
}

/** The parts of a period's group, read back from its text. */
export function readBucket(
  by: PivotDatePeriod,
  bucket: unknown,
): { year: number; part: number; date: Date } | null {
  if (by === 'year') {
    const year = Number(bucket)
    return Number.isFinite(year) ? { year, part: 0, date: localDate(year, 0, 1) } : null
  }
  if (typeof bucket !== 'string') return null
  const m = /^(\d{4})-(Q|W)?(\d{1,2})(?:-(\d{1,2}))?$/.exec(bucket)
  if (!m) return null
  const year = +m[1]!
  const part = +m[3]!
  if (m[2] === 'Q') return { year, part, date: localDate(year, (part - 1) * 3, 1) }
  if (m[2] === 'W') {
    const jan4 = utcDate(year, 0, 4)
    const offset = (jan4.getUTCDay() + 6) % 7
    return { year, part, date: localDate(year, 0, 4 - offset + (part - 1) * 7) }
  }
  return { year, part, date: localDate(year, part - 1, m[4] ? +m[4] : 1) }
}
