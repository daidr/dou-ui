import type { Locale } from '../../locale/types'
import { unitOf } from './date'
import type { DatePickerType } from './date-picker'
import { datePattern, formatWith } from './pattern'

export interface FormatDateValueOptions {
  /** The locale whose date patterns and quarter text are used. */
  locale: Locale
  /** The picker's `type`. Defaults to the unit the value is written in. */
  type?: DatePickerType
  /** A pattern such as `YYYY[年]MM[月]DD[日]`, as the picker's `displayFormat`. */
  displayFormat?: string
}

/**
 * A date value as the date picker shows it in its field: through
 * `displayFormat`, else the locale's pattern for the unit. Weeks stay
 * ISO, quarters follow the locale's text, and a time after a day is kept.
 */
export function formatDateValue(value: string, options: FormatDateValueOptions): string {
  if (!value) return value
  const { locale, displayFormat } = options
  const own = unitOf(value.slice(0, 10))
  const type = options.type === 'datetime' ? 'date' : (options.type ?? own)
  if (type === 'quarter' && /^\d{4}-Q[1-4]$/.test(value))
    return locale.datePicker.quarter
      .replace(/\{year\}/g, value.slice(0, 4))
      .replace(/\{quarter\}/g, value[6]!)
  if (type === 'week' || type === 'quarter') return value
  const parts =
    (displayFormat ? datePattern(displayFormat, type) : null) ??
    datePattern(locale.region[type], type)
  if (!parts) return value
  return formatWith(value.slice(0, 10), parts) + value.slice(10)
}
