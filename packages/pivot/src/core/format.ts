import type { PivotResolvedField, PivotResolvedValue } from '../engine'
import { isEmpty } from '../engine'
import { readBucket, type PivotGroupBy } from '../engine/group'
import type { PivotFormat } from '../engine/types'

export interface PivotLabelTexts {
  empty: string
  yes: string
  no: string
  /** Group labels of a grouping: `{year}`, `{quarter}`, `{week}`, `{from}`, `{to}`. */
  year: string
  quarter: string
  week: string
  range: string
}

const fill = (text: string, params: Record<string, string | number>) =>
  text.replace(/\{(\w+)\}/g, (m, k: string) => String(params[k] ?? m))

const DATE: Intl.DateTimeFormatOptions = { year: 'numeric', month: '2-digit', day: '2-digit' }

/** Writes a group label: the field's `format`, or a plain form of the value. */
export function labelFormatter(
  field: PivotResolvedField<unknown>,
  locale: string,
  texts: PivotLabelTexts,
  by?: PivotGroupBy,
): (value: unknown) => string {
  if (by !== undefined) return groupFormatter(field, locale, texts, by)
  const format = field.format
  const custom =
    typeof format === 'function'
      ? format
      : format && field.type === 'date'
        ? dateFormat(locale, format as Intl.DateTimeFormatOptions)
        : format && field.type === 'number'
          ? numberFormat(locale, format as Intl.NumberFormatOptions)
          : null
  const dates = dateFormat(locale, DATE)
  return (value) => {
    if (isEmpty(value)) return texts.empty
    if (custom) return custom(value)
    if (value instanceof Date) return dates(value)
    if (typeof value === 'boolean') return value ? texts.yes : texts.no
    return String(value)
  }
}

/** Writes the groups of a grouping: periods in the locale's words, ranges by the field's format. */
function groupFormatter(
  field: PivotResolvedField<unknown>,
  locale: string,
  texts: PivotLabelTexts,
  by: PivotGroupBy,
): (value: unknown) => string {
  if (typeof by === 'object') {
    const format = field.format
    const write =
      typeof format === 'function'
        ? (format as (n: number) => string)
        : numberFormat(locale, (format as Intl.NumberFormatOptions) ?? { maximumFractionDigits: 6 })
    return (value) =>
      isEmpty(value)
        ? texts.empty
        : fill(texts.range, {
            from: write(value as number),
            to: write(+((value as number) + by.step).toPrecision(12)),
          })
  }
  const month = dateFormat(locale, { year: 'numeric', month: 'long' })
  const day = dateFormat(locale, DATE)
  return (value) => {
    if (isEmpty(value)) return texts.empty
    const parts = readBucket(by, value)
    if (!parts) return String(value)
    switch (by) {
      case 'year':
        return fill(texts.year, { year: parts.year })
      case 'quarter':
        return fill(texts.quarter, { year: parts.year, quarter: parts.part })
      case 'month':
        return month(parts.date)
      case 'week':
        return fill(texts.week, { year: parts.year, week: parts.part })
      default:
        return day(parts.date)
    }
  }
}

/** Writes a value; an empty cell is blank. */
export function valueFormatter(value: PivotResolvedValue, locale: string): (n: number) => string {
  const format: PivotFormat | undefined = value.format
  const fn =
    typeof format === 'function'
      ? (format as (n: number) => string)
      : value.field?.type === 'date' && (value.aggregate === 'min' || value.aggregate === 'max')
        ? (
            (write) => (n: number) =>
              write(new Date(n))
          )(dateFormat(locale, (format as Intl.DateTimeFormatOptions) ?? DATE))
        : numberFormat(
            locale,
            (format as Intl.NumberFormatOptions) ??
              (value.integer ? { maximumFractionDigits: 0 } : { maximumFractionDigits: 2 }),
          )
  return (n) => (n !== n ? '' : fn(n))
}

const numbers = new Map<string, Intl.NumberFormat>()
const dates = new Map<string, Intl.DateTimeFormat>()

function numberFormat(locale: string, options: Intl.NumberFormatOptions) {
  const key = `${locale}|${JSON.stringify(options)}`
  let format = numbers.get(key)
  if (!format) numbers.set(key, (format = new Intl.NumberFormat(locale, options)))
  return (n: unknown) => format!.format(n as number)
}

function dateFormat(locale: string, options: Intl.DateTimeFormatOptions) {
  const key = `${locale}|${JSON.stringify(options)}`
  let format = dates.get(key)
  if (!format) dates.set(key, (format = new Intl.DateTimeFormat(locale, options)))
  return (d: unknown) => format!.format(d as Date)
}
