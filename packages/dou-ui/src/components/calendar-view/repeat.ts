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
   * for Saturday. Defaults to the weekday of `start`.
   */
  weekdays?: number[]
  /** The last day an occurrence may start on, `YYYY-MM-DD`. */
  until?: string
  /** How many occurrences there are at most, counting the first and the skipped ones. */
  count?: number
  /** Days, `YYYY-MM-DD`, whose occurrence is left out, e.g. a holiday or one moved on its own. */
  except?: string[]
}

/** An event that may repeat; without `repeat` it stands for itself. */
export type RepeatingEvent<Data extends Record<string, unknown> = Record<string, unknown>> =
  CalendarEvent<Data> & { repeat?: CalendarRepeat }

/** Guards against a rule that never reaches the range. */
const LIMIT = 100_000

/**
 * The days a rule falls on from `first`, in order, until `last`. A day of
 * the month that a month doesn't have (the 31st, or 29 February outside a
 * leap year) is skipped rather than moved.
 */
function* daysOf(first: string, rule: CalendarRepeat, last: string) {
  const interval = Math.max(1, Math.floor(rule.interval ?? 1))
  const start = parts(first)
  for (let step = 0, guard = 0; guard < LIMIT; guard++) {
    let date: string | null = null
    if (rule.every === 'day') {
      date = addDays(first, step * interval)
      step++
    } else if (rule.every === 'week') {
      const days = new Set(rule.weekdays?.length ? rule.weekdays : [weekday(first)])
      // weeks counted from the one `first` is in, starting on Sunday
      const week0 = dayIndex(first) - weekday(first)
      date = addDays(first, step)
      step++
      const week = Math.floor((dayIndex(date) - week0) / 7)
      if (week % interval !== 0 || !days.has(weekday(date))) {
        if (date > last) return
        continue
      }
    } else {
      const months = step * interval * (rule.every === 'year' ? 12 : 1)
      step++
      const index = start.year * 12 + start.month - 1 + months
      const year = Math.floor(index / 12)
      const month = (index % 12) + 1
      if (start.day > daysInMonth(year, month)) {
        if (toDateString(year, month, 1) > last) return
        continue
      }
      date = toDateString(year, month, start.day)
    }
    if (date > last) return
    yield date
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
    let count = 0
    for (const date of daysOf(span.from, repeat, last)) {
      if (repeat.count !== undefined && count >= repeat.count) break
      count++
      if (except.has(date) || !touches(date, addDays(date, length))) continue
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
