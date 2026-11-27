import type { SheetValue, SheetWorkbook } from '@dou-ui/sheet/core'

/**
 * The value at a dotted path, e.g. `total.amount`; the data itself for an
 * empty path. A path that isn't text, e.g. a number in JSON written by hand
 * or by a program, finds nothing.
 */
export function valueAt(data: unknown, path: unknown): unknown {
  if (path === undefined || path === null || path === '') return data
  if (typeof path !== 'string') return undefined
  let value = data
  for (const key of path.split('.')) {
    if (value == null || typeof value !== 'object') return undefined
    value = (value as Record<string, unknown>)[key]
  }
  return value
}

/** The rows of a source's data: the data when it is a list, or the list at `path`. Items that aren't objects are left out. */
export function rowsOf(data: unknown, path?: unknown): Record<string, unknown>[] {
  const value = valueAt(data, path)
  if (!Array.isArray(value)) return []
  return value.every(isRecord) ? value : value.filter(isRecord)
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object'

/*
 * A widget's props come from JSON that types don't check, often written by a
 * program or an AI. These read one prop as the type it is meant to be; any
 * other value counts as not set, so a widget never throws on it.
 */

/** Text, or not set. */
export const textOf = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined

/** A list of texts: the texts in it, or none. */
export const textsOf = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []

/** A finite number, or text that is one (`'12'`, as a number read from data); otherwise not set. */
export function numberOf(value: unknown): number | undefined {
  const n =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim()
        ? Number(value)
        : Number.NaN
  return Number.isFinite(n) ? n : undefined
}

/** On only for `true`: `'no'` or `1` don't turn a switch on. */
export const flagOf = (value: unknown): boolean => value === true

/** A plain object, not a list; otherwise not set. */
export const recordOf = (value: unknown): Record<string, unknown> | undefined =>
  isRecord(value) && !Array.isArray(value) ? value : undefined

/** One of the values listed, or not set. */
export const oneOf = <T extends string>(value: unknown, values: readonly T[]): T | undefined =>
  values.includes(value as T) ? (value as T) : undefined

/** The keys of the first row of a list, or of an object: the fields to pick from in settings. */
export function fieldsOf(data: unknown): string[] {
  const first = Array.isArray(data) ? data[0] : data
  return first && typeof first === 'object' && !Array.isArray(first) ? Object.keys(first) : []
}

/** The keys whose value in the first row is a number. */
export function numberFieldsOf(data: unknown): string[] {
  const first = Array.isArray(data) ? data[0] : data
  return fieldsOf(data).filter((key) => typeof (first as Record<string, unknown>)[key] === 'number')
}

/** A filter value from a value of the data: dates as JSON-safe local text. */
const pad = (n: number, width = 2) => String(n).padStart(width, '0')

const LOCAL_DATE_TIME =
  /^(\d{4})-(\d{1,2})(?:-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?)?)?$/
const ZONED_DATE_TIME =
  /^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?(?:([Zz])|([+-])(\d{2}):?(\d{2}))$/

function localDayStart(year: number, month: number, day: number): number {
  if (year >= 0 && year < 100) {
    const d = new Date(0)
    d.setFullYear(year, month, day)
    d.setHours(0, 0, 0, 0)
    return d.getTime()
  }
  return new Date(year, month, day).getTime()
}

function isAmbiguousLocalTime(time: number): boolean {
  const offset = new Date(time).getTimezoneOffset()
  const later = new Date(time + 7_200_000).getTimezoneOffset()
  if (later > offset) {
    const shift = (later - offset) * 60_000
    if (new Date(time + shift).getTimezoneOffset() === later) return true
  }
  const earlier = new Date(time - 7_200_000).getTimezoneOffset()
  if (earlier < offset) {
    const shift = (offset - earlier) * 60_000
    if (new Date(time - shift).getTimezoneOffset() === earlier) return true
  }
  return false
}

function daysInMonth(year: number, month: number): number {
  const d = new Date(0)
  d.setUTCFullYear(year, month, 0)
  return d.getUTCDate()
}

function parseZonedDateTimestamp(match: RegExpExecArray): number {
  const [, y, mo, d, h, mi, s, ms, z, sign, oh, om] = match
  const year = Number(y)
  const month = Number(mo)
  const day = Number(d)
  const hour = Number(h)
  const minute = Number(mi)
  const second = s ? Number(s) : 0
  const millis = ms ? Number(ms.slice(0, 3).padEnd(3, '0')) : 0
  const offHour = z ? 0 : Number(oh)
  const offMin = z ? 0 : Number(om)
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth(year, month) ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    offHour > 23 ||
    offMin > 59
  )
    return Number.NaN
  const date = new Date(0)
  date.setUTCFullYear(year, month - 1, day)
  date.setUTCHours(hour, minute, second, millis)
  const offset = z ? 0 : (sign === '+' ? 1 : -1) * (offHour * 60 + offMin)
  return date.getTime() - offset * 60_000
}

function parseDateTimestamp(text: string): number {
  const trimmed = text.trim()
  const local = LOCAL_DATE_TIME.exec(trimmed)
  if (local) {
    const year = Number(local[1])
    const month = Number(local[2])
    const day = local[3] ? Number(local[3]) : 1
    const hour = local[4] ? Number(local[4]) : 0
    const minute = local[5] ? Number(local[5]) : 0
    const second = local[6] ? Number(local[6]) : 0
    const ms = local[7] ? Number(local[7].slice(0, 3).padEnd(3, '0')) : 0
    if (
      month < 1 ||
      month > 12 ||
      day < 1 ||
      day > daysInMonth(year, month) ||
      hour > 23 ||
      minute > 59 ||
      second > 59
    )
      return Number.NaN
    if (year < 100) {
      const d = new Date(0)
      d.setFullYear(year, month - 1, day)
      d.setHours(hour, minute, second, ms)
      return d.getTime()
    }
    return new Date(year, month - 1, day, hour, minute, second, ms).getTime()
  }
  const zoned = ZONED_DATE_TIME.exec(trimmed)
  if (zoned) return parseZonedDateTimestamp(zoned)
  return Number.NaN
}

export function filterValueOf(value: unknown): unknown {
  if (!(value instanceof Date)) return value
  const time = value.getTime()
  if (Number.isNaN(time)) return undefined
  const year = value.getFullYear()
  const month = value.getMonth()
  const day = value.getDate()
  const date = `${pad(year, 4)}-${pad(month + 1)}-${pad(day)}`
  if (time === localDayStart(year, month, day)) return date
  const h = pad(value.getHours())
  const mi = pad(value.getMinutes())
  const s = value.getSeconds()
  const ms = value.getMilliseconds()
  if (isAmbiguousLocalTime(time)) {
    const off = -value.getTimezoneOffset()
    const sign = off >= 0 ? '+' : '-'
    const abs = Math.abs(off)
    const frac = ms ? `.${pad(ms, 3)}` : ''
    return `${date}T${h}:${mi}:${pad(s)}${frac}${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  }
  if (ms) return `${date} ${h}:${mi}:${pad(s)}.${pad(ms, 3)}`
  return s ? `${date} ${h}:${mi}:${pad(s)}` : `${date} ${h}:${mi}`
}

/** Whether a row value and a filter value represent the same value, including matching date instants. */
export function sameFilterValue(a: unknown, b: unknown): boolean {
  const fa = filterValueOf(a)
  const fb = filterValueOf(b)
  if (fa === fb) return true
  if (typeof fa !== 'string' || typeof fb !== 'string') return false
  const ta = parseDateTimestamp(fa)
  const tb = parseDateTimestamp(fb)
  return Number.isFinite(ta) && Number.isFinite(tb) && ta === tb
}

/** A value of the data as a sheet cell's: dates as wall-clock text, text starting with `=` kept as text. */
function sheetValueOf(value: unknown): SheetValue {
  if (value == null) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'boolean') return value
  if (value instanceof Date) {
    const formatted = filterValueOf(value)
    return typeof formatted === 'string' ? formatted : null
  }
  const text = String(value)
  return text.startsWith('=') ? `'${text}` : text
}

/**
 * Rows of data as a workbook, for the dashboard's export menu: one sheet,
 * a bold head row with the columns' titles, a row per row of data. An
 * empty `name` takes the widget's title.
 */
export function rowsToWorkbook(
  name: string,
  columns: readonly { key: string; title: string; width?: number }[],
  rows: readonly Record<string, unknown>[],
): SheetWorkbook {
  const colSizes: Record<number, number> = {}
  columns.forEach((column, i) => column.width && (colSizes[i] = Math.round(column.width)))
  return {
    version: 1,
    sheets: [
      {
        name,
        cells: [
          columns.map((column) => ({ value: sheetValueOf(column.title), style: 'head' })),
          ...rows.map((row) => columns.map((column) => sheetValueOf(row[column.key]))),
        ],
        freeze: { rows: 1, cols: 0 },
        colSizes,
      },
    ],
    styles: { head: { bold: true } },
  }
}
