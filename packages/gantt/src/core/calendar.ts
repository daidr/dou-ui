import { dayIndex, MINUTES_PER_DAY, parseClock, parseTime } from './time'

/** Which days and hours are worked. */
export interface GanttCalendar {
  /** Days of the week off, `0` is Sunday. Defaults to `[0, 6]`. */
  weekends?: number[]
  /** Days off besides the weekend, as `YYYY-MM-DD`. */
  holidays?: string[]
  /** Weekend days that are worked anyway, as `YYYY-MM-DD`. They win over `weekends`. */
  workdays?: string[]
  /** The working hours of a working day, as `HH:mm`. Defaults to `['09:00', '18:00']`. */
  hours?: [string, string]
}

/** A calendar with its strings read, for fast lookups. */
export interface WorkCalendar {
  isWorkday: (day: number) => boolean
  /** Working hours as minutes since midnight. */
  hours: [number, number]
}

const days = (list: string[] | undefined) => {
  const out = new Set<number>()
  for (const text of list ?? []) {
    const parsed = parseTime(text)
    if (parsed) out.add(dayIndex(parsed.at))
  }
  return out
}

export function resolveCalendar(calendar: GanttCalendar = {}): WorkCalendar {
  const weekends = new Set(calendar.weekends ?? [0, 6])
  const holidays = days(calendar.holidays)
  const workdays = days(calendar.workdays)
  const from = parseClock(calendar.hours?.[0]) ?? 9 * 60
  const to = parseClock(calendar.hours?.[1]) ?? 18 * 60
  return {
    // 1970-01-01 was a Thursday
    isWorkday: (day) =>
      workdays.has(day) || (!holidays.has(day) && !weekends.has((((day + 4) % 7) + 7) % 7)),
    hours: from < to ? [from, to] : [9 * 60, 18 * 60],
  }
}

/** Working days that start in `[from, to)`. */
export function workdaysBetween(calendar: WorkCalendar, from: number, to: number) {
  let count = 0
  for (let day = Math.ceil(from / MINUTES_PER_DAY); day * MINUTES_PER_DAY < to; day++)
    if (calendar.isWorkday(day)) count++
  return count
}

/** Working minutes in `[from, to)`: the working hours of working days. */
export function workingMinutes(calendar: WorkCalendar, from: number, to: number) {
  const [open, close] = calendar.hours
  let total = 0
  for (let day = dayIndex(from); day * MINUTES_PER_DAY < to; day++) {
    if (!calendar.isWorkday(day)) continue
    const base = day * MINUTES_PER_DAY
    const start = Math.max(from, base + open)
    const end = Math.min(to, base + close)
    if (end > start) total += end - start
  }
  return total
}

export interface TimeRange {
  start: number
  end: number
}

/**
 * The stretches of `[from, to)` that are not worked: whole days off, and
 * with `hours`, the evenings and mornings of working days too. Adjacent
 * stretches are merged.
 */
export function offTime(calendar: WorkCalendar, from: number, to: number, hours = false) {
  const out: TimeRange[] = []
  const push = (start: number, end: number) => {
    start = Math.max(start, from)
    end = Math.min(end, to)
    if (end <= start) return
    const last = out[out.length - 1]
    if (last && last.end >= start) last.end = Math.max(last.end, end)
    else out.push({ start, end })
  }
  const [open, close] = calendar.hours
  for (let day = dayIndex(from); day * MINUTES_PER_DAY < to; day++) {
    const base = day * MINUTES_PER_DAY
    if (!calendar.isWorkday(day)) push(base, base + MINUTES_PER_DAY)
    else if (hours) {
      push(base, base + open)
      push(base + close, base + MINUTES_PER_DAY)
    }
  }
  return out
}
