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
 * and in short form ("12万", "1.2M") once the numbers get long.
 */
export function numberTickFormat(locale: string, ticks: number[]): (value: number) => string {
  const step = ticks.length > 1 ? Math.abs(ticks[1]! - ticks[0]!) : 0
  const largest = Math.max(0, ...ticks.map(Math.abs))
  if (largest >= 1e5 && step >= 1e3) {
    const compact = numberFormat(locale, { notation: 'compact', maximumFractionDigits: 2 })
    return (value) => compact.format(value)
  }
  // enough decimals for every tick (explicit ticks need not be multiples of a power of ten)
  let decimals = step > 0 ? stepDecimals(step) : 2
  for (const tick of ticks) {
    const text = String(Number(tick.toPrecision(12)))
    const dot = text.indexOf('.')
    if (dot >= 0 && !text.includes('e')) decimals = Math.max(decimals, text.length - dot - 1)
  }
  const plain = numberFormat(locale, { maximumFractionDigits: decimals })
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

/** Formats a point in time in full, as precise as `unit` (tooltips, the accessible summary). */
export function timeFormatFull(locale: string, unit: TimeUnit = 'day'): (value: number) => string {
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
              hourCycle: 'h23',
            }
  const format = dateFormat(locale, options)
  return (value) => format.format(value)
}
