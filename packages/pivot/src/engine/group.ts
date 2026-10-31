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

/**
 * A date out of a value: a `Date`, a time in ms, or text such as
 * `'2026-03-15'` (read in local time, like the other parts of a day).
 */
export function toDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  if (typeof value === 'number') return Number.isFinite(value) ? new Date(value) : null
  if (typeof value === 'string') {
    const day = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value.trim())
    // a bare date is midnight here, not in UTC
    const date = day ? new Date(+day[1]!, +day[2]! - 1, +day[3]!) : new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
  }
  return null
}

/** The ISO week a day is in, and the year that week belongs to. */
export function isoWeek(date: Date): [year: number, week: number] {
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  // the Thursday of the same week decides the year
  const weekday = (day.getDay() + 6) % 7
  day.setDate(day.getDate() - weekday + 3)
  const year = day.getFullYear()
  const first = new Date(year, 0, 4)
  const firstThursday = new Date(year, 0, 4 - ((first.getDay() + 6) % 7) + 3)
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
        return `${year}-Q${Math.floor(date.getMonth() / 3) + 1}`
      case 'month':
        return `${year}-${pad(date.getMonth() + 1)}`
      case 'week': {
        const [y, w] = isoWeek(date)
        return `${y}-W${pad(w)}`
      }
      default:
        return `${year}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
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
    return Number.isFinite(year) ? { year, part: 0, date: new Date(year, 0, 1) } : null
  }
  if (typeof bucket !== 'string') return null
  const m = /^(\d{4})-(Q|W)?(\d{1,2})(?:-(\d{1,2}))?$/.exec(bucket)
  if (!m) return null
  const year = +m[1]!
  const part = +m[3]!
  if (m[2] === 'Q') return { year, part, date: new Date(year, (part - 1) * 3, 1) }
  if (m[2] === 'W') return { year, part, date: new Date(year, 0, 4 + (part - 1) * 7) }
  return { year, part, date: new Date(year, part - 1, m[4] ? +m[4] : 1) }
}
