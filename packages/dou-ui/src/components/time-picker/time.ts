/** Time values are `HH:mm` or `HH:mm:ss` strings, with no date and no time zone. */

export type TimeFormat = 'HH:mm' | 'HH:mm:ss'

export interface TimeParts {
  hour: number
  minute: number
  second: number
}

const pad = (value: number) => String(value).padStart(2, '0')

export function formatTime({ hour, minute, second }: TimeParts, format: TimeFormat): string {
  const base = `${pad(hour)}:${pad(minute)}`
  return format === 'HH:mm:ss' ? `${base}:${pad(second)}` : base
}

/** Read what was typed: `9`, `9:5`, `09:05:30`, also with a full-width colon. */
export function parseTime(text: string): TimeParts | null {
  const match = /^\s*(\d{1,2})(?:\s*[:：.]\s*(\d{1,2}))?(?:\s*[:：.]\s*(\d{1,2}))?\s*$/.exec(text)
  if (!match) return null
  const [hour, minute, second] = [match[1], match[2], match[3]].map((part) => Number(part ?? 0))
  if (hour! > 23 || minute! > 59 || second! > 59) return null
  return { hour: hour!, minute: minute!, second: second! }
}

export function now(): TimeParts {
  const date = new Date()
  return { hour: date.getHours(), minute: date.getMinutes(), second: date.getSeconds() }
}

/** Round a part down onto its step, so the value always matches a row in the panel. */
const down = (value: number, step: number) => value - (value % step)

export function snap(parts: TimeParts, steps: [number, number, number]): TimeParts {
  return {
    hour: down(parts.hour, steps[0]),
    minute: down(parts.minute, steps[1]),
    second: down(parts.second, steps[2]),
  }
}

/**
 * Times that cannot be picked, one rule per column. Each rule gets the
 * value of its column and of the columns before it.
 */
export interface DisabledTime {
  hour?: (hour: number) => boolean
  minute?: (minute: number, hour: number) => boolean
  second?: (second: number, minute: number, hour: number) => boolean
}

const range = (count: number, step: number) =>
  Array.from({ length: Math.ceil(count / step) }, (_, index) => index * step)

/** Whether a cell of a column is ruled out, given the parts picked in the columns before it. */
export function isUnitDisabled(
  rule: DisabledTime | undefined,
  unit: keyof TimeParts,
  value: number,
  parts: TimeParts,
): boolean {
  if (!rule) return false
  if (unit === 'hour') return !!rule.hour?.(value)
  if (unit === 'minute') return !!rule.minute?.(value, parts.hour)
  return !!rule.second?.(value, parts.minute, parts.hour)
}

/** Whether a whole time is ruled out. Seconds count only when they are picked. */
export function isTimeDisabled(
  parts: TimeParts,
  rule: DisabledTime | undefined,
  seconds: boolean,
): boolean {
  if (!rule) return false
  return (
    isUnitDisabled(rule, 'hour', parts.hour, parts) ||
    isUnitDisabled(rule, 'minute', parts.minute, parts) ||
    (seconds && isUnitDisabled(rule, 'second', parts.second, parts))
  )
}

/**
 * Keep a time allowed: each part that is ruled out, given the parts before
 * it, moves to the first allowed value of its column. `null` when a column
 * has nothing left to pick.
 */
export function fitTime(
  parts: TimeParts,
  rule: DisabledTime | undefined,
  steps: [number, number, number],
  seconds: boolean,
): TimeParts | null {
  if (!rule) return parts
  const next = { ...parts }
  const units: [keyof TimeParts, number, number][] = [
    ['hour', 24, steps[0]],
    ['minute', 60, steps[1]],
    ['second', 60, steps[2]],
  ]
  for (const [unit, count, step] of units) {
    if (unit === 'second' && !seconds) break
    if (!isUnitDisabled(rule, unit, next[unit], next)) continue
    const free = range(count, step).find((value) => !isUnitDisabled(rule, unit, value, next))
    if (free === undefined) return null
    next[unit] = free
  }
  return next
}
