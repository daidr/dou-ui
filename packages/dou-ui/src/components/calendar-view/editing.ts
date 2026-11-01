import { addDays, parts } from '../date-picker/date'
import type { CalendarEvent } from './calendar-view'
import { readMoment, spanOf } from './time-layout'
import type { EventSpan } from './time-layout'

/*
 * Moving events in time. Dates and times are wall-clock values as written,
 * with no time zone: a day is always 24 hours long, so arithmetic goes
 * through a count of minutes since 1970-01-01 00:00 on a UTC calendar.
 */

const DAY = 24 * 60
const MS_PER_DAY = 86_400_000
const pad = (value: number, length = 2) => String(value).padStart(length, '0')

/** Days since 1970-01-01. */
export function dayIndex(date: string): number {
  const { year, month, day } = parts(date)
  const value = new Date(Date.UTC(2000, month - 1, day))
  value.setUTCFullYear(year)
  return Math.round(value.getTime() / MS_PER_DAY)
}

function dateOfIndex(index: number): string {
  const value = new Date(index * MS_PER_DAY)
  return `${pad(value.getUTCFullYear(), 4)}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`
}

/** A day and a time as minutes since 1970-01-01 00:00. */
export const toStamp = (date: string, minutes: number) => dayIndex(date) * DAY + minutes

/** Minutes since 1970-01-01 00:00 as `YYYY-MM-DD HH:mm`. */
export function formatStamp(stamp: number): string {
  const day = Math.floor(stamp / DAY)
  const minutes = stamp - day * DAY
  return `${dateOfIndex(day)} ${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`
}

/** Minutes since midnight as `HH:mm`. */
export const formatTime = (minutes: number) =>
  `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`

/** Moves a written date by whole days, keeping its time if it has one. */
function shiftText(text: string, days: number): string {
  const moment = readMoment(text)
  if (!moment) return text
  const date = addDays(moment.date, days)
  return moment.minutes === null ? date : `${date} ${formatTime(moment.minutes)}`
}

/** Where a span starts and ends, in minutes since 1970-01-01; an all-day one covers its whole days. */
export function stampsOf(span: EventSpan): { start: number; end: number } {
  return {
    start: toStamp(span.from, span.start ?? 0),
    end: toStamp(span.to, span.end ?? DAY),
  }
}

/**
 * The event moved by whole days, and a timed one also by minutes. An
 * all-day event keeps its dates whole. An `end` is written only when the
 * event had one, so an event that ran an hour by default still does.
 */
export function moveEvent(
  event: CalendarEvent,
  span: EventSpan,
  { days = 0, minutes = 0 }: { days?: number; minutes?: number },
): CalendarEvent {
  if (span.start === null) {
    const next = { ...event, start: shiftText(event.start, days) }
    if (event.end !== undefined) next.end = shiftText(event.end, days)
    return next
  }
  const delta = days * DAY + minutes
  const { start, end } = stampsOf(span)
  const next = { ...event, start: formatStamp(start + delta) }
  if (event.end !== undefined) next.end = formatStamp(end + delta)
  return next
}

/** When the event ends, written out: the last day of an all-day event, or the moment a timed one ends. */
export function endOf(event: CalendarEvent): string {
  const span = spanOf(event)
  if (!span) return event.end ?? event.start
  return span.start === null ? span.to : formatStamp(stampsOf(span).end)
}

/** Whether two versions of an event cover the same time. */
export function sameTime(a: CalendarEvent, b: CalendarEvent) {
  return a.start === b.start && endOf(a) === endOf(b)
}
