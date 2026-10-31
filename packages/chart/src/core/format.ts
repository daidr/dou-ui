import { stepDecimals } from './scale'
import { floorTime, parentUnit, startsUnit, type TimeInterval, type TimeUnit } from './time'

const formatters = new Map<string, Intl.NumberFormat | Intl.DateTimeFormat>()

function numberFormat(locale: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `n:${locale}:${JSON.stringify(options)}`
  let format = formatters.get(key) as Intl.NumberFormat | undefined
  if (!format) formatters.set(key, (format = new Intl.NumberFormat(locale, options)))
  return format
}

function dateFormat(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `d:${locale}:${JSON.stringify(options)}`
  let format = formatters.get(key) as Intl.DateTimeFormat | undefined
  if (!format) formatters.set(key, (format = new Intl.DateTimeFormat(locale, options)))
  return format
}

/**
 * Formats the ticks of a number axis: as many decimals as the step needs,
 * and in short form ("12万", "1.2M") once the numbers get long, with as
 * many digits as it takes to tell the ticks apart. With `years`, whole
 * numbers under 10000 go without separators, so 2019 doesn't read "2,019".
 */
export function numberTickFormat(
  locale: string,
  ticks: number[],
  { years = false }: { years?: boolean } = {},
): (value: number) => string {
  const step = ticks.length > 1 ? Math.abs(ticks[1]! - ticks[0]!) : 0
  const largest = Math.max(0, ...ticks.map(Math.abs))
  if (largest >= 1e5 && step >= 1e3) {
    for (let digits = 2; ; digits++) {
      const compact = numberFormat(locale, { notation: 'compact', maximumFractionDigits: digits })
      const texts = ticks.map((tick) => compact.format(tick))
      if (new Set(texts).size === texts.length || digits >= 8)
        return (value) => compact.format(value)
    }
  }
  // enough decimals for every tick (explicit ticks need not be multiples of a power of ten)
  let decimals = step > 0 ? stepDecimals(step) : 2
  for (const tick of ticks) {
    const text = String(Number(tick.toPrecision(12)))
    const dot = text.indexOf('.')
    if (dot >= 0 && !text.includes('e')) decimals = Math.max(decimals, text.length - dot - 1)
  }
  const grouping = !(years && ticks.every((tick) => Number.isInteger(tick) && Math.abs(tick) < 1e4))
  const plain = numberFormat(locale, { maximumFractionDigits: decimals, useGrouping: grouping })
  return (value) => plain.format(value)
}

/** Formats a value for reading in full (tooltips, the accessible summary). */
export function numberFormatFull(locale: string): (value: number) => string {
  const plain = numberFormat(locale, { maximumFractionDigits: 4 })
  return (value) => plain.format(value)
}

const UNIT_FORMATS: Record<TimeUnit, Intl.DateTimeFormatOptions> = {
  second: { hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' },
  minute: { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' },
  hour: { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' },
  day: { day: 'numeric' },
  week: { day: 'numeric' },
  month: { month: 'short' },
  year: { year: 'numeric' },
}

const CONTEXT_FORMATS: Partial<Record<TimeUnit, Intl.DateTimeFormatOptions>> = {
  // the first tick, and each new day / month / year, says which one it is
  minute: { month: 'short', day: 'numeric' },
  day: { month: 'short', day: 'numeric' },
  month: { year: 'numeric', month: 'short' },
}

/**
 * Formats the ticks of a time axis. Most ticks show only the unit they
 * step by ("15日", "09:00"); the first one and the first in each bigger
 * unit say more ("11月2日", "2026年1月"), so the axis reads without a legend.
 * `previous` is the tick before, if any.
 */
export function timeTickFormat(
  locale: string,
  interval: TimeInterval,
): (value: number, previous?: number) => string {
  const unit = interval.unit
  const plain = dateFormat(locale, UNIT_FORMATS[unit])
  const parent = parentUnit(unit)
  const contextUnit =
    unit === 'hour' || unit === 'second' ? 'minute' : unit === 'week' ? 'day' : unit
  const context = CONTEXT_FORMATS[contextUnit]
  const contextFormat = context ? dateFormat(locale, context) : null
  // hours and minutes: a new day is marked by its date alone
  const dayOnly = unit === 'hour' || unit === 'minute' || unit === 'second'
  return (value, previous) => {
    const startsParent =
      parent !== null &&
      previous !== undefined &&
      floorTime(previous, parent).getTime() !== floorTime(value, parent).getTime()
    if (contextFormat && (previous === undefined || startsParent)) {
      if (dayOnly && !startsUnit(value, 'day')) {
        // the first tick of a time-of-day axis that doesn't start at midnight
        return plain.format(value)
      }
      if (unit === 'month' && startsParent)
        return dateFormat(locale, { year: 'numeric' }).format(value)
      return contextFormat.format(value)
    }
    return plain.format(value)
  }
}

/** How fine a time must be written for points `step` ms apart: 0 days, 1 minutes, 2 seconds, 4 to 6 parts of a second. */
const rank = (step: number) =>
  step < 1000
    ? 3 + (step >= 100 ? 1 : step >= 10 ? 2 : 3)
    : step < 60e3
      ? 2
      : step < 86400e3
        ? 1
        : 0

/**
 * How precisely a point in time needs writing: as precise as the time
 * itself (09:30 needs minutes), and as its neighbor is near (points 100ms
 * apart need tenths of a second, even on a whole second). `digits` are
 * the digits of a second, from 1 to 3.
 */
export function timePrecision(value: number, gap = Number.POSITIVE_INFINITY) {
  const date = new Date(value)
  const ms = date.getMilliseconds()
  const own =
    ms !== 0
      ? rank(ms % 100 === 0 ? 100 : ms % 10 === 0 ? 10 : 1)
      : date.getSeconds() !== 0
        ? 2
        : date.getMinutes() !== 0 || date.getHours() !== 0
          ? 1
          : 0
  const r = Math.max(own, gap > 0 ? rank(gap) : 0)
  const unit: TimeUnit = r === 0 ? 'day' : r === 1 ? 'minute' : 'second'
  return { unit, digits: (r > 3 ? r - 3 : 0) as 0 | 1 | 2 | 3 }
}

/** Formats a point in time in full, as precise as `unit` (tooltips, the accessible summary). */
export function timeFormatFull(
  locale: string,
  unit: TimeUnit = 'day',
  /** Digits of a second, for times less than a second apart. */
  digits: 0 | 1 | 2 | 3 = 0,
): (value: number) => string {
  const options: Intl.DateTimeFormatOptions =
    unit === 'year'
      ? { year: 'numeric' }
      : unit === 'month'
        ? { year: 'numeric', month: 'short' }
        : unit === 'day' || unit === 'week'
          ? { year: 'numeric', month: 'short', day: 'numeric' }
          : {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              second: unit === 'second' ? '2-digit' : undefined,
              fractionalSecondDigits: unit === 'second' && digits ? digits : undefined,
              hourCycle: 'h23',
            }
  const format = dateFormat(locale, options)
  return (value) => format.format(value)
}
