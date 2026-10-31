/**
 * Ticks on a time axis, at round points of local time: whole minutes,
 * midnights, the first of a month. The step is the smallest one that
 * gives no more than the wanted number of ticks.
 */

export type TimeUnit = 'second' | 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year'

export interface TimeInterval {
  unit: TimeUnit
  every: number
}

const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

const INTERVALS: Array<[TimeUnit, number, number]> = [
  ['second', 1, SECOND],
  ['second', 5, 5 * SECOND],
  ['second', 15, 15 * SECOND],
  ['second', 30, 30 * SECOND],
  ['minute', 1, MINUTE],
  ['minute', 5, 5 * MINUTE],
  ['minute', 15, 15 * MINUTE],
  ['minute', 30, 30 * MINUTE],
  ['hour', 1, HOUR],
  ['hour', 3, 3 * HOUR],
  ['hour', 6, 6 * HOUR],
  ['hour', 12, 12 * HOUR],
  ['day', 1, DAY],
  ['day', 2, 2 * DAY],
  ['week', 1, 7 * DAY],
  ['week', 2, 14 * DAY],
  ['month', 1, 30 * DAY],
  ['month', 3, 91 * DAY],
  ['month', 6, 182 * DAY],
  ['year', 1, 365 * DAY],
]

/** The smallest interval that gives at most `count` ticks across `span` ms. */
export function timeInterval(span: number, count: number): TimeInterval {
  for (const [unit, every, length] of INTERVALS) {
    if (span / length <= Math.max(1, count)) return { unit, every }
  }
  // whole years, a nice number of them
  const years = span / (365 * DAY) / Math.max(1, count)
  const power = 10 ** Math.floor(Math.log10(years))
  const fraction = years / power
  return {
    unit: 'year',
    every: (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10) * power,
  }
}

/** The start of the `unit` that `time` falls in (weeks start on Monday). */
export function floorTime(time: number, unit: TimeUnit): Date {
  const d = new Date(time)
  switch (unit) {
    case 'year':
      return new Date(d.getFullYear(), 0, 1)
    case 'month':
      return new Date(d.getFullYear(), d.getMonth(), 1)
    case 'week': {
      const back = (d.getDay() + 6) % 7
      return new Date(d.getFullYear(), d.getMonth(), d.getDate() - back)
    }
    case 'day':
      return new Date(d.getFullYear(), d.getMonth(), d.getDate())
    case 'hour':
      return new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours())
    case 'minute':
      return new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes())
    default:
      return new Date(Math.floor(time / SECOND) * SECOND)
  }
}

/** Whether `date` is on a multiple of `every` within the next unit up, so steps line up. */
function aligned(date: Date, { unit, every }: TimeInterval): boolean {
  if (every === 1) return true
  switch (unit) {
    case 'year':
      return date.getFullYear() % every === 0
    case 'month':
      return date.getMonth() % every === 0
    case 'day':
      return (date.getDate() - 1) % every === 0 && date.getDate() + every - 1 <= 31
    case 'hour':
      return date.getHours() % every === 0
    case 'minute':
      return date.getMinutes() % every === 0
    case 'second':
      return date.getSeconds() % every === 0
    case 'week':
      // counted from a Monday long ago, so the same weeks are picked whatever is shown
      return Math.round((date.getTime() - new Date(1970, 0, 5).getTime()) / (7 * DAY)) % every === 0
    default:
      return true
  }
}

function next(date: Date, unit: TimeUnit): Date {
  const d = new Date(date)
  switch (unit) {
    case 'year':
      d.setFullYear(d.getFullYear() + 1)
      break
    case 'month':
      d.setMonth(d.getMonth() + 1)
      break
    case 'week':
      d.setDate(d.getDate() + 7)
      break
    case 'day':
      d.setDate(d.getDate() + 1)
      break
    case 'hour':
      // by the clock, so a daylight saving change doesn't shift every tick after it
      return new Date(d.getTime() + HOUR)
    case 'minute':
      return new Date(d.getTime() + MINUTE)
    default:
      return new Date(d.getTime() + SECOND)
  }
  return d
}

/** The ticks of `interval` from `lo` to `hi` (ms), both ends included when they fall on one. */
export function timeTicks(lo: number, hi: number, interval: TimeInterval): number[] {
  const ticks: number[] = []
  if (!(hi >= lo)) return ticks
  let date = floorTime(lo, interval.unit)
  // a guard against runaway loops on absurd spans
  for (let guard = 0; guard < 10000 && date.getTime() <= hi; guard++) {
    if (date.getTime() >= lo && aligned(date, interval)) ticks.push(date.getTime())
    date = next(date, interval.unit)
  }
  return ticks
}

/** The next unit up, whose boundaries a tick label marks with more context. */
export function parentUnit(unit: TimeUnit): TimeUnit | null {
  switch (unit) {
    case 'second':
      return 'minute'
    case 'minute':
    case 'hour':
      return 'day'
    case 'day':
    case 'week':
      return 'month'
    case 'month':
      return 'year'
    default:
      return null
  }
}

/** Whether `time` is the very start of a `unit`. */
export function startsUnit(time: number, unit: TimeUnit): boolean {
  return floorTime(time, unit).getTime() === time
}
