import { generalNumber, parseInput } from '../core/format'
import type { SheetValue } from '../core/model'
import { isSheetError, VALUE, type SheetError } from './error'

/**
 * What a formula gives: a number, text, `TRUE` / `FALSE`, nothing (an
 * empty cell), or an error. Dates are text written `2026-03-05` (or
 * `2026-03-05 09:30`), as cells hold them.
 */
export type SheetResult = number | string | boolean | null | SheetError

/** A range a function is given: its cells, as their values or their formulas' results. */
export interface SheetRangeArg {
  readonly kind: 'range'
  /** Its size, kept inside the sheet: `A:A` is as tall as the sheet. */
  readonly rows: number
  readonly cols: number
  /** The cell at a row and column counted from the range's top left, from 0. */
  at(row: number, col: number): SheetResult
  /**
   * The cells with something in them, row by row, with where they are.
   * Empty cells are left out, so a whole column costs only its data.
   */
  entries(): Iterable<[row: number, col: number, value: SheetResult]>
}

/** What a function is given for each argument: a value, or a range for a reference to more than one cell. */
export type SheetArg = SheetResult | SheetRangeArg

export const isRange = (arg: unknown): arg is SheetRangeArg =>
  typeof arg === 'object' && arg !== null && (arg as SheetRangeArg).kind === 'range'

// Dates as day numbers, counted the usual way from 1899-12-30, so date
// arithmetic and functions agree with other spreadsheet programs.

const DATE = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/
const TIME = /^(\d{2}):(\d{2})(?::(\d{2}))?$/
const EPOCH = Date.UTC(1899, 11, 30)
const DAY = 86_400_000

/** Whether a value is a date (or date and time) as cells write them. */
export const isDateText = (value: unknown): value is string =>
  typeof value === 'string' && DATE.test(value)

/** Whether a value is a time of day as cells write it, such as `09:30`. */
export const isTimeText = (value: unknown): value is string =>
  typeof value === 'string' && TIME.test(value)

/** A date or time written in a cell as a day number (a time as part of a day); `null` when it isn't one. */
export function serialOf(text: string): number | null {
  const date = DATE.exec(text)
  if (date) {
    const [, y, m, d, h = '0', min = '0', s = '0'] = date
    const ms = Date.UTC(+y!, +m! - 1, +d!, +h, +min, +s)
    return (ms - EPOCH) / DAY
  }
  const time = TIME.exec(text)
  if (time) return (+time[1]! * 3600 + +time[2]! * 60 + +(time[3] ?? 0)) / 86_400
  return null
}

const pad = (n: number) => String(n).padStart(2, '0')

/** A day number as a date, with its time when it has a part of a day. */
export function dateText(serial: number) {
  const ms = Math.round((serial * DAY + EPOCH) / 1000) * 1000
  const d = new Date(ms)
  const day = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
  const seconds = d.getUTCHours() * 3600 + d.getUTCMinutes() * 60 + d.getUTCSeconds()
  if (!seconds) return day
  const time = `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
  return d.getUTCSeconds() ? `${day} ${time}:${pad(d.getUTCSeconds())}` : `${day} ${time}`
}

/** A part of a day as `hh:mm`, or `hh:mm:ss` with seconds; a whole day and more wraps round. */
export function timeText(fraction: number) {
  const seconds = Math.round((((fraction % 1) + 1) % 1) * 86_400) % 86_400
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const sec = seconds % 60
  return sec ? `${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(h)}:${pad(m)}`
}

/** A part of a day as a time; a whole day or more, or below nothing, stays a number of days. */
export const timeOrDays = (days: number): number | string =>
  days >= 0 && days < 1 ? timeText(days) : days

/** The parts of a date, from a date or a day number; `null` when it is neither. */
export function dateParts(value: SheetResult) {
  const serial =
    typeof value === 'number' ? value : typeof value === 'string' ? serialOf(value) : null
  if (serial == null) return null
  const d = new Date(Math.floor(serial) * DAY + EPOCH)
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(), serial }
}

/**
 * A value as a number: `TRUE` is 1, an empty cell 0, text that reads as a
 * number (`12`, `1,280`, `12%`) or a date its number; other text is
 * `#VALUE!`. Errors pass through.
 */
export function toNumber(value: SheetResult): number | SheetError {
  if (typeof value === 'number') return value
  if (value == null) return 0
  if (typeof value === 'boolean') return value ? 1 : 0
  if (isSheetError(value)) return value
  const trimmed = value.trim()
  if (trimmed === '') return VALUE
  const serial = serialOf(trimmed)
  if (serial != null) return serial
  const read = parseInput(trimmed).value
  return typeof read === 'number' ? read : VALUE
}

/** A value as text: numbers as a cell shows them without a format, `TRUE` / `FALSE`. */
export function toText(value: SheetResult): string | SheetError {
  if (value == null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number') return generalNumber(value)
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
  return value
}

/** A value as `TRUE` / `FALSE`: numbers are true unless 0; text `TRUE` / `FALSE` reads as such. */
export function toBoolean(value: SheetResult): boolean | SheetError {
  if (typeof value === 'boolean') return value
  if (value == null) return false
  if (typeof value === 'number') return value !== 0
  if (isSheetError(value)) return value
  const upper = value.trim().toUpperCase()
  if (upper === 'TRUE') return true
  if (upper === 'FALSE') return false
  return VALUE
}

/**
 * Compares two values the way formulas do: numbers by size, text by
 * letters ignoring case, `FALSE` before `TRUE`; numbers come before text,
 * and text before `TRUE` / `FALSE`. An empty cell is 0, or "" next to text.
 */
export function compareValues(a: SheetResult, b: SheetResult): number {
  if (a == null) a = typeof b === 'string' ? '' : typeof b === 'boolean' ? false : 0
  if (b == null) b = typeof a === 'string' ? '' : typeof a === 'boolean' ? false : 0
  const rank = (v: SheetResult) => (typeof v === 'number' ? 0 : typeof v === 'string' ? 1 : 2)
  const ra = rank(a)
  const rb = rank(b)
  if (ra !== rb) return ra - rb
  if (typeof a === 'number') return a - (b as number)
  if (typeof a === 'string') {
    const x = a.toLowerCase()
    const y = (b as string).toLowerCase()
    return x < y ? -1 : x > y ? 1 : 0
  }
  return Number(a) - Number(b)
}

/**
 * A cell's value as it shows: for a formula, its result from `result`
 * (an error as its code, such as `#N/A`), when given.
 */
export function shownValue(
  value: SheetValue,
  result: ((row: number, col: number) => SheetResult) | undefined,
  row: number,
  col: number,
): SheetValue {
  if (!result || typeof value !== 'string' || !value.startsWith('=')) return value
  const out = result(row, col)
  return isSheetError(out) ? out.code : out
}
