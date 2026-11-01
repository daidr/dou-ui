import { addDays, daysInMonth, parts, toDateString, weekday } from '../date-picker/date'
import type { CalendarRange, CalendarViewMode } from './calendar-view'

/**
 * The days a calendar shows, first to last as `YYYY-MM-DD`, for a day it is
 * on and a view: the six weeks of the month grid, the week, the day, or the
 * month of the agenda. Pass the same `weekStart` as the calendar: the
 * locale's, e.g. `1` (Monday) in Chinese, unless you set `week-start`.
 *
 * It gives `range-change`'s value before the calendar is mounted, e.g. for
 * the first render on the server.
 */
export function visibleRange(date: string, view: CalendarViewMode, weekStart = 0): CalendarRange {
  const back = (day: string) => addDays(day, -((weekday(day) - weekStart + 7) % 7))
  if (view === 'day') return { start: date, end: date }
  if (view === 'week') {
    const start = back(date)
    return { start, end: addDays(start, 6) }
  }
  const { year, month } = parts(date)
  const first = toDateString(year, month, 1)
  if (view === 'agenda')
    return { start: first, end: toDateString(year, month, daysInMonth(year, month)) }
  const start = back(first)
  return { start, end: addDays(start, 41) }
}
