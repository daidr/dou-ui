import { addDays, daysInMonth, parts, toDateString, weekday } from '../date-picker/date'
import type { CalendarEvent } from './calendar-view'
import { dayIndex, moveEvent } from './editing'
import { spanOf } from './time-layout'

/**
 * How an event repeats. Occurrences fall on the same time of day as the
 * first one, which is the event's own `start`.
 */
export interface CalendarRepeat {
  /** The unit it repeats by. */
  every: 'day' | 'week' | 'month' | 'year'
  /** Every this many units, e.g. `2` with `week` for every other week. Defaults to `1`. */
  interval?: number
  /**
   * With `week`: the days of the week it falls on, `0` for Sunday to `6`
   * for Saturday. Defaults to the weekday of `start`. When `start` is not
   * on one of them, the series begins on the first of them after it.
   */
  weekdays?: readonly number[]
  /**
   * With `week` and an `interval` over 1: the day weeks begin on, which
   * decides which weeks are "every other". `0` for Sunday, the default.
   */
  weekStart?: number
  /** The last day an occurrence may start on, `YYYY-MM-DD`. */
  until?: string
  /** How many occurrences there are at most, counting those left out by `except`. */
  count?: number
  /** Days, `YYYY-MM-DD`, whose occurrence is left out, e.g. a holiday or one moved on its own. */
  except?: readonly string[]
}

/** An event that may repeat; without `repeat` it stands for itself. */
export type RepeatingEvent<Data extends Record<string, unknown> = Record<string, unknown>> =
  CalendarEvent<Data> & { repeat?: CalendarRepeat }

const warned = new Set<string>()
/** Says once per message, while developing, that a rule can't be followed as written. */
function warn(message: string) {
  // the app's bundler replaces this, as for Vue's own warnings
  if (process.env.NODE_ENV === 'production' || warned.has(message)) return
  warned.add(message)
  console.warn(`[dou-ui] expandRepeats: ${message}`)
}

const isDay = (value: number) => Number.isInteger(value) && value >= 0 && value <= 6

/** The rule's `interval`, `weekStart` and `weekdays`, read leniently with a warning for bad ones. */
function settle(id: string, rule: CalendarRepeat, first: string) {
  let interval = rule.interval ?? 1
  if (!Number.isInteger(interval) || interval < 1) {
    warn(
      `event "${id}" has interval ${rule.interval}; it must be a whole number of 1 or more, so 1 is used.`,
    )
    interval = 1
  }
  let weekStart = rule.weekStart ?? 0
  if (!isDay(weekStart)) {
    warn(
      `event "${id}" has weekStart ${rule.weekStart}; use 0 (Sunday) to 6 (Saturday). 0 is used.`,
    )
    weekStart = 0
  }
  let weekdays = rule.weekdays?.length ? rule.weekdays : [weekday(first)]
  if (rule.every === 'week' && weekdays.some((day) => !isDay(day))) {
    warn(
      `event "${id}" has weekdays [${weekdays.join(', ')}]; use 0 (Sunday) to 6 (Saturday). The others are left out.`,
    )
    weekdays = weekdays.filter(isDay)
  }
  return { interval, weekStart, weekdays }
}

/**
 * The days a rule falls on, in order, from the first one that starts on or
 * after `lo` until `hi`, each with its number in the series counting from
 * 1. It goes straight to `lo` rather than counting up from `first`, so a
 * series that began long ago costs no more than a new one.
 *
 * A day of the month that a month doesn't have (the 31st, or 29 February
 * outside a leap year) is skipped rather than moved, and not counted.
 */
function* daysOf(
  id: string,
  first: string,
  rule: CalendarRepeat,
  lo: string,
  hi: string,
): Generator<{ date: string; n: number }> {
  const { interval, weekStart, weekdays } = settle(id, rule, first)
  const firstIndex = dayIndex(first)
  const gap = Math.max(0, dayIndex(lo) - firstIndex)
  if (rule.every === 'day') {
    let k = Math.ceil(gap / interval)
    for (let date = addDays(first, k * interval); date <= hi; date = addDays(date, interval))
      yield { date, n: ++k }
    return
  }
  if (rule.every === 'week') {
    // weeks are counted from the one `first` is in, starting on `weekStart`
    // oxlint-disable-next-line unicorn/no-array-sort -- sorts a fresh array
    const offsets = [...new Set(weekdays.map((day) => (day - weekStart + 7) % 7))].sort(
      (a, b) => a - b,
    )
    if (!offsets.length) return
    const week0 = firstIndex - ((weekday(first) - weekStart + 7) % 7)
    // `first` itself is an occurrence only when it is on one of the days
    const inFirst = offsets.filter((offset) => week0 + offset >= firstIndex).length
    const span = 7 * interval
    let period = Math.max(0, Math.floor((firstIndex + gap - week0) / span))
    let n = period === 0 ? 0 : inFirst + (period - 1) * offsets.length
    for (; ; period++) {
      for (const offset of offsets) {
        const index = week0 + period * span + offset
        if (index < firstIndex) continue
        const date = addDays(first, index - firstIndex)
        if (date > hi) return
        n++
        if (date >= lo) yield { date, n }
      }
    }
  }
  // month and year: months that lack the day are skipped and not counted
  const start = parts(first)
  const step = interval * (rule.every === 'year' ? 12 : 1)
  const base = start.year * 12 + start.month - 1
  const lack = (k: number) => {
    const index = base + k * step
    return start.day > daysInMonth(Math.floor(index / 12), (index % 12) + 1)
  }
  const low = parts(lo)
  let k = Math.max(0, Math.floor((low.year * 12 + low.month - 1 - base) / step) - 1)
  let n = 0
  if (start.day <= 28) n = k
  else for (let j = 0; j < k; j++) if (!lack(j)) n++
  for (; ; k++) {
    const index = base + k * step
    const year = Math.floor(index / 12)
    const month = (index % 12) + 1
    if (toDateString(year, month, 1) > hi) return
    if (lack(k)) continue
    n++
    const date = toDateString(year, month, start.day)
    if (date > hi) return
    if (date >= lo) yield { date, n }
  }
}

/**
 * Spreads repeating events into the occurrences that touch the days from
 * `from` to `to` (both `YYYY-MM-DD`, inclusive), ready for `events`. An
 * event without `repeat` is kept when it touches the range.
 *
 * Each occurrence is a copy of the event moved to its day, without
 * `repeat`, and with the id `<id>@<YYYY-MM-DD>`; `occurrenceOf` reads it
 * back. Occurrences are made up on the fly, so bind them with `:events`
 * and handle `change` to decide what a drag means: the whole series, or
 * this one day (add it to `except` and store it as an event of its own).
 */
export function expandRepeats<Data extends Record<string, unknown> = Record<string, unknown>>(
  events: RepeatingEvent<Data>[],
  from: string,
  to: string,
): CalendarEvent<Data>[] {
  const out: CalendarEvent<Data>[] = []
  for (const event of events) {
    const span = spanOf(event)
    if (!span) continue
    const touches = (first: string, last: string) => last >= from && first <= to
    const { repeat, ...plain } = event
    if (!repeat) {
      if (touches(span.from, span.to)) out.push(plain)
      continue
    }
    const length = dayIndex(span.to) - dayIndex(span.from)
    const except = new Set(repeat.except)
    const last = repeat.until && repeat.until < to ? repeat.until : to
    // an occurrence that starts up to `length` days before `from` still reaches it
    for (const { date, n } of daysOf(event.id, span.from, repeat, addDays(from, -length), last)) {
      if (repeat.count !== undefined && n > repeat.count) break
      if (except.has(date)) continue
      const days = dayIndex(date) - dayIndex(span.from)
      out.push({
        ...(moveEvent(plain, span, { days }) as CalendarEvent<Data>),
        id: `${event.id}@${date}`,
      })
    }
  }
  return out
}

/** The series and day of an occurrence made by `expandRepeats`, or `null` for any other id. */
export function occurrenceOf(id: string): { id: string; date: string } | null {
  const match = /^(.*)@(\d{4}-\d{2}-\d{2})$/.exec(id)
  return match ? { id: match[1]!, date: match[2]! } : null
}
