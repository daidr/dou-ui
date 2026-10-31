import { dayIndex, MINUTES_PER_DAY, parseClock, parseTime } from './time'

/** Which days and hours are worked. */
export interface GanttCalendar {
  /** Days of the week off, `0` is Sunday. Defaults to `[0, 6]`. */
  weekends?: number[]
  /** Days off besides the weekend, as `YYYY-MM-DD`. */
  holidays?: string[]
  /** Weekend days that are worked anyway, as `YYYY-MM-DD`. They win over `weekends`. */
  workdays?: string[]
  /**
   * The working hours of a working day, as `HH:mm`: one stretch such as
   * `['09:00', '18:00']` (the default), or several to leave out a break,
   * such as `[['09:00', '12:00'], ['13:00', '18:00']]`.
   */
  hours?: [string, string] | [string, string][]
}

/** A calendar with its strings read, for fast lookups. */
export interface WorkCalendar {
  isWorkday: (day: number) => boolean
  /** Working stretches of a day as minutes since midnight, in order and apart. */
  hours: [number, number][]
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
  return {
    // 1970-01-01 was a Thursday
    isWorkday: (day) =>
      workdays.has(day) || (!holidays.has(day) && !weekends.has((((day + 4) % 7) + 7) % 7)),
    hours: readHours(calendar.hours),
  }
}

const DEFAULT_HOURS: [number, number][] = [[9 * 60, 18 * 60]]

/** Reads the working stretches, sorted, with overlaps merged; bad ones are dropped. */
function readHours(hours: GanttCalendar['hours']): [number, number][] {
  if (!hours?.length) return DEFAULT_HOURS
  const list = (typeof hours[0] === 'string' ? [hours] : hours) as [string, string][]
  const read: [number, number][] = []
  for (const [a, b] of list) {
    const from = parseClock(a)
    const to = parseClock(b)
    if (from != null && to != null && from < to) read.push([from, to])
  }
  // oxlint-disable-next-line unicorn/no-array-sort -- sorts a fresh array
  read.sort((x, y) => x[0] - y[0])
  const out: [number, number][] = []
  for (const range of read) {
    const last = out[out.length - 1]
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1])
    else out.push([...range])
  }
  return out.length ? out : DEFAULT_HOURS
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
  let total = 0
  for (let day = dayIndex(from); day * MINUTES_PER_DAY < to; day++) {
    if (!calendar.isWorkday(day)) continue
    const base = day * MINUTES_PER_DAY
    for (const [open, close] of calendar.hours) {
      const start = Math.max(from, base + open)
      const end = Math.min(to, base + close)
      if (end > start) total += end - start
    }
  }
  return total
}

export interface TimeRange {
  start: number
  end: number
}

/**
 * The stretches of `[from, to)` that are not worked: whole days off, and
 * with `hours`, the hours outside work on working days too. Adjacent
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
  for (let day = dayIndex(from); day * MINUTES_PER_DAY < to; day++) {
    const base = day * MINUTES_PER_DAY
    if (!calendar.isWorkday(day)) push(base, base + MINUTES_PER_DAY)
    else if (hours) {
      // the gaps around and between the working stretches
      let at = 0
      for (const [open, close] of calendar.hours) {
        push(base + at, base + open)
        at = close
      }
      push(base + at, base + MINUTES_PER_DAY)
    }
  }
  return out
}
