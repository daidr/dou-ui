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
      return m.halves[p.month > 6 ? 1 : 0]
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

/** The last moment of a span as a reader expects it: a date-only span ends on its last day. */
export const endLabel = (span: TaskSpan, m: GanttMessages) =>
  dateLabel(span.dateOnly ? span.end - MINUTES_PER_DAY : span.end, span.dateOnly, m)

/** Working days for a date-only span, working hours otherwise. */
export function durationLabel(span: TaskSpan, calendar: WorkCalendar, m: GanttMessages) {
  if (span.dateOnly)
    return format(m.days, { count: workdaysBetween(calendar, span.start, span.end) })
  const hours = workingMinutes(calendar, span.start, span.end) / MINUTES_PER_HOUR
  return format(m.hours, { count: Math.round(hours * 10) / 10 })
}
