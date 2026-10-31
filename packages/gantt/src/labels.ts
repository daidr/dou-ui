import { workdaysBetween, workingMinutes, type WorkCalendar } from './core/calendar'
import type { TaskSpan } from './core/model'
import type { TimeUnit } from './core/scale'
import { MINUTES_PER_DAY, MINUTES_PER_HOUR, partsOf } from './core/time'
import { format, type GanttMessages } from './locale'

const pad = (n: number) => String(n).padStart(2, '0')

/** The text of a header cell for the `unit` starting at `at`. */
export function unitLabel(unit: TimeUnit, at: number, m: GanttMessages, dayWidth: number) {
  const p = partsOf(at)
  const month = m.months[p.month - 1]!
  const weekday = m.weekdays[p.weekday]!
  switch (unit) {
    case 'year':
      return format(m.year, { year: p.year })
    case 'half':
      // a half year narrower than its name keeps only its gridline
      return dayWidth * 181 >= 56 ? m.halves[p.month > 6 ? 1 : 0] : ''
    case 'quarter':
      return format(m.quarter, { quarter: Math.ceil(p.month / 3) })
    case 'month':
      return dayWidth >= 8
        ? format(m.yearMonth, { year: p.year, month })
        : format(m.month, { month })
    case 'week':
      return format(m.monthDay, { month, day: p.day })
    case 'day':
      // the top row at hour level, or a day cell wide enough for its weekday
      return dayWidth >= 288
        ? format(m.dayWithWeekday, { month, day: p.day, weekday })
        : dayWidth >= 64
          ? `${p.day} ${weekday}`
          : String(p.day)
    case 'hour':
      return format(m.hour, { hour: pad(p.hour) })
  }
}

/** A date for reading out or for a table cell: `3月5日`, with the time when it has one. */
export function dateLabel(at: number, dateOnly: boolean, m: GanttMessages) {
  const p = partsOf(at)
  const date = format(m.monthDay, { month: m.months[p.month - 1]!, day: p.day })
  return dateOnly ? date : format(m.dateTime, { date, time: `${pad(p.hour)}:${pad(p.minute)}` })
}

/**
 * The last moment of a span as a reader expects it: a date-only span ends
 * on its last day (a summary ending on a milestone, at noon, on that day).
 */
export const endLabel = (span: TaskSpan, m: GanttMessages) =>
  dateLabel(span.dateOnly ? span.end - 1 : span.end, span.dateOnly, m)

/** Working days for a date-only span, working hours otherwise. */
export function durationLabel(span: TaskSpan, calendar: WorkCalendar, m: GanttMessages) {
  if (span.dateOnly)
    return format(m.days, { count: workdaysBetween(calendar, span.start, span.end) })
  const hours = workingMinutes(calendar, span.start, span.end) / MINUTES_PER_HOUR
  return format(m.hours, { count: Math.round(hours * 10) / 10 })
}

/** A task's dates, read out: just the date for a task of one whole day. */
export function datesLabel(span: TaskSpan, m: GanttMessages) {
  const start = dateLabel(span.start, span.dateOnly, m)
  if (span.dateOnly && span.end - span.start === MINUTES_PER_DAY) return start
  return format(m.range, { start, end: endLabel(span, m) })
}

/** The duration, read out: says so when it has no working time at all. */
export function spokenDuration(span: TaskSpan, calendar: WorkCalendar, m: GanttMessages) {
  const working = span.dateOnly
    ? workdaysBetween(calendar, span.start, span.end)
    : workingMinutes(calendar, span.start, span.end)
  if (!working) return span.dateOnly ? m.offDays : m.offHours
  return durationLabel(span, calendar, m)
}

/** Labels narrower than this are left out rather than cut to a letter or two, in px. */
const MARKER_MIN = 28

/**
 * How wide each marker label may be so it stops short of the next one to
 * its right: `Infinity` for the last, `0` when there is no useful room.
 */
export function markerRoom(xs: readonly number[]) {
  const order = xs.map((x, i) => i)
  order.sort((a, b) => xs[a]! - xs[b]!)
  const room: number[] = xs.map(() => Infinity)
  for (let k = 0; k < order.length - 1; k++) {
    const i = order[k]!
    // the label starts 4px right of its line; leave 4px before the next one
    const width = xs[order[k + 1]!]! - xs[i]! - 8
    room[i] = width >= MARKER_MIN ? width : 0
  }
  return room
}
