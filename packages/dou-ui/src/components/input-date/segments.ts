/**
 * The model of a segmented date or time field: a display pattern cut into
 * editable parts (year, month, day, hour, minute, second, AM/PM) and the
 * literal text between them, plus the rules for typing into a part and
 * stepping it with the arrow keys.
 *
 * Values in and out are the same plain strings the date and time pickers
 * use: `YYYY-MM-DD`, `YYYY-MM`, `YYYY`, `YYYY-MM-DD HH:mm(:ss)` and
 * `HH:mm(:ss)`. The pattern only changes how a value is shown and typed.
 */
import { daysInMonth, toDateString } from '../date-picker/date'

export type SegmentType = 'year' | 'month' | 'day' | 'hour' | 'minute' | 'second' | 'meridiem'
export type SegmentKind = 'date' | 'datetime' | 'month' | 'year' | 'time'

export type Part = { type: SegmentType; token: string } | { type: 'literal'; text: string }

/** What is known of one value; `null` for a part not filled in yet. */
export type Fields = Record<SegmentType, number | null>

const TOKENS: [string, SegmentType][] = [
  ['YYYY', 'year'],
  ['MM', 'month'],
  ['DD', 'day'],
  ['HH', 'hour'],
  ['hh', 'hour'],
  ['mm', 'minute'],
  ['ss', 'second'],
  ['A', 'meridiem'],
]

/**
 * Cut a pattern such as `YYYY-MM-DD HH:mm` or `MM/DD/YYYY hh:mm A` into
 * parts. Text in square brackets is kept as it is: `YYYY[年]MM[月]`.
 */
export function parsePattern(pattern: string): Part[] {
  const parts: Part[] = []
  const literal = (text: string) => {
    const last = parts.at(-1)
    if (last?.type === 'literal') last.text += text
    else parts.push({ type: 'literal', text })
  }
  let at = 0
  while (at < pattern.length) {
    if (pattern[at] === '[') {
      const end = pattern.indexOf(']', at)
      if (end > at) {
        literal(pattern.slice(at + 1, end))
        at = end + 1
        continue
      }
    }
    const token = TOKENS.find(([text]) => pattern.startsWith(text, at))
    if (token) {
      parts.push({ type: token[1], token: token[0] })
      at += token[0].length
    } else {
      literal(pattern[at]!)
      at += 1
    }
  }
  return parts
}

/** Whether a pattern shows the hour on a 12-hour clock. */
export const isHour12 = (parts: Part[]) =>
  parts.some((part) => part.type === 'hour' && part.token === 'hh')

/** The parts a value of each kind is made of. */
export function requiredSegments(kind: SegmentKind, seconds: boolean, hour12: boolean) {
  const date: SegmentType[] =
    kind === 'year' ? ['year'] : kind === 'month' ? ['year', 'month'] : ['year', 'month', 'day']
  const time: SegmentType[] = ['hour', 'minute']
  if (seconds) time.push('second')
  if (hour12) time.push('meridiem')
  if (kind === 'time') return time
  if (kind === 'datetime') return [...date, ...time]
  return date
}

/** Whether a pattern has every part a kind needs, and nothing it can't hold. */
export function fitsKind(parts: Part[], kind: SegmentKind, seconds: boolean) {
  const types = parts.flatMap((part) => (part.type === 'literal' ? [] : [part.type]))
  if (new Set(types).size !== types.length) return false
  const needed = requiredSegments(kind, seconds, isHour12(parts))
  if (types.includes('meridiem') !== isHour12(parts)) return false
  return types.length === needed.length && needed.every((type) => types.includes(type))
}

export const emptyFields = (): Fields => ({
  year: null,
  month: null,
  day: null,
  hour: null,
  minute: null,
  second: null,
  meridiem: null,
})

/** The smallest and largest value a part takes, given what else is known. */
export function bounds(type: SegmentType, fields: Fields, hour12: boolean): [number, number] {
  switch (type) {
    case 'year':
      return [1, 9999]
    case 'month':
      return [1, 12]
    case 'day':
      // Without a year, February may still have its 29th.
      return [1, fields.month === null ? 31 : daysInMonth(fields.year ?? 2000, fields.month)]
    case 'hour':
      return hour12 ? [1, 12] : [0, 23]
    case 'meridiem':
      return [0, 1]
    default:
      return [0, 59]
  }
}

/** How many digits a part holds. */
export const digits = (type: SegmentType) => (type === 'year' ? 4 : type === 'meridiem' ? 0 : 2)

/** Pull the day back into the month after the month or the year changed. */
export function clampDay(fields: Fields): Fields {
  if (fields.day === null) return fields
  const [, max] = bounds('day', fields, false)
  return fields.day > max ? { ...fields, day: max } : fields
}

export interface Typed {
  /** The digits typed into the part so far. */
  buffer: string
  /** The value they make, or `null` while they make none (a lone `0` in a month). */
  value: number | null
  /** No further digit could make a valid value, so focus moves on. */
  done: boolean
}

/**
 * Add a typed digit to a part. A digit that would overflow the part starts
 * it over, so `1` then `3` in a month gives `3`, the way a native date
 * field behaves.
 */
export function typeDigit(
  type: SegmentType,
  buffer: string,
  digit: string,
  [min, max]: [number, number],
): Typed {
  const length = digits(type)
  let next = buffer + digit
  if (next.length > length || Number(next) > max) next = digit
  const number = Number(next)
  const value = number >= min && number <= max ? number : null
  return { buffer: next, value, done: next.length >= length || number * 10 > max }
}

/**
 * Step a part by `amount`, wrapping around except for the year. A step
 * larger than one lands on a multiple of it, so minutes with a step of 15
 * go 00, 15, 30, 45.
 */
export function stepValue(
  type: SegmentType,
  value: number | null,
  amount: number,
  [min, max]: [number, number],
  step = 1,
  start?: number,
): number {
  if (value === null) {
    if (start !== undefined) return start
    return amount > 0 ? min : Math.floor(max / step) * step
  }
  if (type === 'year') return Math.min(max, Math.max(min, value + amount))
  if (step > 1 && min === 0) {
    const count = Math.floor(max / step) + 1
    let index = Math.floor(value / step)
    // Off the grid, the first step down only lands on the grid.
    index += amount > 0 || value % step === 0 ? amount : amount + 1
    return (((index % count) + count) % count) * step
  }
  const span = max - min + 1
  return ((((value + amount - min) % span) + span) % span) + min
}

const pad = (value: number, length: number) => String(value).padStart(length, '0')

/** A part's value as shown. */
export function formatSegment(type: SegmentType, value: number, meridiems: [string, string]) {
  if (type === 'meridiem') return meridiems[value] ?? ''
  return pad(value, digits(type))
}

/** Put the parts together into a value of a kind, or `null` while one is missing. */
export function toValue(
  kind: SegmentKind,
  fields: Fields,
  seconds: boolean,
  hour12: boolean,
): string | null {
  if (requiredSegments(kind, seconds, hour12).some((type) => fields[type] === null)) return null
  const { year, month, day, minute, second, meridiem } = fields
  if (kind === 'year') return pad(year!, 4)
  if (kind === 'month') return `${pad(year!, 4)}-${pad(month!, 2)}`
  const date = toDateString(year!, month!, day ?? 1)
  if (kind === 'date') return date
  const hour = hour12 ? (fields.hour! % 12) + (meridiem ? 12 : 0) : fields.hour!
  const time = `${pad(hour, 2)}:${pad(minute!, 2)}${seconds ? `:${pad(second ?? 0, 2)}` : ''}`
  return kind === 'time' ? time : `${date} ${time}`
}

/** Spread a value into its parts. Anything unreadable gives empty parts. */
export function fromValue(kind: SegmentKind, value: string | null | undefined, hour12: boolean) {
  const fields = emptyFields()
  if (!value) return fields
  const date = kind === 'time' ? '' : value.slice(0, 10)
  const time = kind === 'time' ? value : kind === 'datetime' ? value.slice(11) : ''
  const dateMatch = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/.exec(date)
  if (dateMatch) {
    fields.year = Number(dateMatch[1])
    if (dateMatch[2]) fields.month = Number(dateMatch[2])
    if (dateMatch[3]) fields.day = Number(dateMatch[3])
  }
  const timeMatch = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(time)
  if (timeMatch) {
    const hour = Number(timeMatch[1])
    fields.hour = hour12 ? hour % 12 || 12 : hour
    fields.meridiem = hour12 ? (hour >= 12 ? 1 : 0) : null
    fields.minute = Number(timeMatch[2])
    fields.second = timeMatch[3] ? Number(timeMatch[3]) : 0
  }
  return fields
}
