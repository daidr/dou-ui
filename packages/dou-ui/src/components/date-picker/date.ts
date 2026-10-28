/**
 * Calendar dates as plain strings: `YYYY-MM-DD`, `YYYY-MM` or `YYYY`.
 *
 * A date picker deals in days, not instants, so values never carry a time
 * or a time zone and compare correctly as strings. Arithmetic goes
 * through UTC, where every day is 24 hours long.
 */

export type DateUnit = 'date' | 'month' | 'year'

const pad = (value: number, length = 2) => String(value).padStart(length, '0')

export function toDateString(year: number, month: number, day: number) {
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`
}

export function parts(date: string) {
  const [year = 1970, month = 1, day = 1] = date.split('-').map(Number)
  return { year, month, day }
}

export function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function fromUTC(date: Date) {
  return toDateString(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate())
}

function utc(date: string) {
  const { year, month, day } = parts(date)
  const value = new Date(Date.UTC(2000, month - 1, day))
  value.setUTCFullYear(year)
  return value
}

export function addDays(date: string, days: number) {
  const value = utc(date)
  value.setUTCDate(value.getUTCDate() + days)
  return fromUTC(value)
}

/** Move by months, keeping the day where the target month has it, else its last day. */
export function addMonths(date: string, months: number) {
  const { year, month, day } = parts(date)
  const index = year * 12 + (month - 1) + months
  const nextYear = Math.floor(index / 12)
  const nextMonth = (index % 12) + 1
  return toDateString(nextYear, nextMonth, Math.min(day, daysInMonth(nextYear, nextMonth)))
}

/** `0` is Sunday. */
export function weekday(date: string) {
  return utc(date).getUTCDay()
}

export function today() {
  const now = new Date()
  return toDateString(now.getFullYear(), now.getMonth() + 1, now.getDate())
}

/** Cut a full date down to the unit a value is stored in. */
export function truncate(date: string, unit: DateUnit) {
  if (unit === 'year') return date.slice(0, 4)
  if (unit === 'month') return date.slice(0, 7)
  return date
}

/** Fill a value of a coarser unit out to a full date: its first day. */
export function expand(value: string) {
  if (/^\d{4}$/.test(value)) return `${value}-01-01`
  if (/^\d{4}-\d{2}$/.test(value)) return `${value}-01`
  return value
}

/**
 * Read what someone typed as a value of `unit`, or `null`. Accepts `-`,
 * `/` or `.` between the parts and single-digit months and days.
 */
export function parseDate(text: string, unit: DateUnit): string | null {
  const match = text.trim().match(/^(\d{4})(?:[-/.](\d{1,2}))?(?:[-/.](\d{1,2}))?$/)
  if (!match) return null
  const year = Number(match[1])
  const month = match[2] === undefined ? undefined : Number(match[2])
  const day = match[3] === undefined ? undefined : Number(match[3])
  if (unit === 'year') return month === undefined ? pad(year, 4) : null
  if (month === undefined || month < 1 || month > 12) return null
  if (unit === 'month') return day === undefined ? `${pad(year, 4)}-${pad(month)}` : null
  if (day === undefined || day < 1 || day > daysInMonth(year, month)) return null
  return toDateString(year, month, day)
}

/** Whether a value lies within `min` and `max`, compared at the value's own unit. */
export function inBounds(value: string, min?: string, max?: string) {
  if (min && value < truncate(expand(min), unitOf(value))) return false
  if (max && value > truncate(expand(max), unitOf(value))) return false
  return true
}

export function unitOf(value: string): DateUnit {
  if (value.length === 4) return 'year'
  if (value.length === 7) return 'month'
  return 'date'
}
