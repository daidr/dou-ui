import { addDays } from '../date-picker/date'
import type { CalendarEvent } from './calendar-view'

const DAY = 24 * 60
const PATTERN = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::\d{2})?)?$/

/** `HH:mm` as minutes since midnight, or `null`. */
export function toMinutes(time: string | undefined): number | null {
  const match = time && /^(\d{1,2}):(\d{2})/.exec(time)
  if (!match) return null
  const minutes = Number(match[1]) * 60 + Number(match[2])
  return minutes >= 0 && minutes <= DAY ? minutes : null
}

/**
 * Reads `YYYY-MM-DD` or `YYYY-MM-DD HH:mm`; seconds are accepted and
 * dropped. `null` for anything else.
 */
export function readMoment(
  text: string | undefined,
): { date: string; minutes: number | null } | null {
  const match = text ? PATTERN.exec(text.trim()) : null
  if (!match) return null
  const [, y, mo, d, h, mi] = match
  const date = `${y}-${mo}-${d}`
  // rejects days past the end of the month, e.g. 02-30
  if (addDays(date, 0) !== date) return null
  if (h == null) return { date, minutes: null }
  const minutes = Number(h) * 60 + Number(mi)
  return Number(h) > 23 || Number(mi) > 59 ? null : { date, minutes }
}

/** Where an event falls: the days it covers and, for a timed one, its times. */
export interface EventSpan {
  event: CalendarEvent
  /** The first day, `YYYY-MM-DD`. */
  from: string
  /** The last day it shows on. */
  to: string
  /** Minutes since midnight on `from`; `null` for an all-day event. */
  start: number | null
  /** Minutes since midnight on `to`, up to `1440`; `null` for an all-day event. */
  end: number | null
}

/**
 * An event with a time in `start` is timed and `end` is the moment it ends,
 * an hour later by default. Without one it is an all-day event and `end`
 * is its last day; an `end` at `00:00` makes the day before the last.
 * `null` when `start` can't be read.
 */
export function spanOf(event: CalendarEvent): EventSpan | null {
  const start = readMoment(event.start)
  if (!start) return null
  const end = readMoment(event.end)
  if (start.minutes === null) {
    // an end at midnight means the day before is the last
    const last = end && (end.minutes === 0 ? addDays(end.date, -1) : end.date)
    const to = last && last > start.date ? last : start.date
    return { event, from: start.date, to, start: null, end: null }
  }
  let to = start.date
  let minutes = start.minutes + 60
  if (
    end &&
    (end.date > start.date || (end.date === start.date && (end.minutes ?? DAY) > start.minutes))
  ) {
    to = end.date
    minutes = end.minutes ?? DAY
  }
  while (minutes > DAY) {
    to = addDays(to, 1)
    minutes -= DAY
  }
  // ending at midnight ends on the day before
  if (minutes === 0 && to > start.date) {
    to = addDays(to, -1)
    minutes = DAY
  }
  return { event, from: start.date, to, start: start.minutes, end: minutes }
}

/** The part of a timed event on one day, in minutes since midnight. */
export function segmentOn(span: EventSpan, date: string) {
  return {
    start: date === span.from ? (span.start ?? 0) : 0,
    end: date === span.to ? (span.end ?? DAY) : DAY,
  }
}

export interface PlacedEvent {
  event: CalendarEvent
  /** Minutes since midnight. */
  start: number
  end: number
  /** Which of the side-by-side columns it takes, from 0. */
  column: number
  /** How many columns its group of overlapping events needs. */
  columns: number
  /** How many columns it covers, widening into free columns on its right. */
  span: number
}

/**
 * Lay out one day's timed events. Events that overlap, directly or through
 * others, form a group; each takes the leftmost column free at its start,
 * and the whole group shares the width between its columns. An event then
 * widens to the right over columns that stay free for its whole time.
 */
export function layoutDay(
  segments: { event: CalendarEvent; start: number; end: number }[],
): PlacedEvent[] {
  const placed: PlacedEvent[] = segments.map(({ event, start, end }) => ({
    event,
    start,
    end: Math.min(Math.max(end, start + 15), DAY),
    column: 0,
    columns: 1,
    span: 1,
  }))
  // oxlint-disable-next-line unicorn/no-array-sort -- sorts a fresh array
  placed.sort((a, b) => a.start - b.start || b.end - a.end)

  let group: PlacedEvent[] = []
  let ends: number[] = []
  let groupEnd = -1
  const overlaps = (a: PlacedEvent, b: PlacedEvent) => a.start < b.end && b.start < a.end
  const close = () => {
    for (const item of group) {
      item.columns = ends.length
      let next = item.column + 1
      while (
        next < ends.length &&
        !group.some((other) => other.column === next && overlaps(item, other))
      )
        next++
      item.span = next - item.column
    }
    group = []
    ends = []
  }
  for (const item of placed) {
    if (item.start >= groupEnd) close()
    let column = ends.findIndex((end) => end <= item.start)
    if (column < 0) column = ends.push(item.end) - 1
    else ends[column] = item.end
    item.column = column
    group.push(item)
    groupEnd = Math.max(groupEnd, item.end)
  }
  close()
  return placed
}
