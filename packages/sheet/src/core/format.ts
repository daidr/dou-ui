import type { SheetValue } from './model'

/*
 * Showing values and reading what is typed into a cell.
 *
 * Number formats are a small, predictable subset of the usual pattern
 * language: digits (`0` always shown, `#` only when needed), a thousands
 * comma, `%`, and text before and after (in quotes, after `\`, or symbols
 * such as `¥`). Up to three sections split by `;` are for positive
 * numbers, negative numbers (shown without their sign) and zero; a section
 * without digits shows its text as it is.
 *
 * Date formats apply to dates written as `YYYY-MM-DD[ HH:mm[:ss]]` and
 * times written as `HH:mm[:ss]`: `yyyy`, `yy`, `m`, `mm` (month, or minutes
 * after an hour or before seconds), `d`, `dd`, `ddd` and `dddd` (the
 * weekday, short and long, in the given locale), `h`, `hh`, `s` and `ss`.
 * Other letters and quoted text show as they are. `@` shows the value as
 * text.
 */

interface NumberPattern {
  prefix: string
  suffix: string
  /** Digits always shown after the point, and digits shown when needed. */
  fixed: number
  optional: number
  /** Digits always shown before the point. */
  whole: number
  grouping: boolean
  percent: boolean
}

const DATE_VALUE = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/
const TIME_VALUE = /^(\d{2}):(\d{2})(?::(\d{2}))?$/
const DATE_PART = /^(?:yyyy|yy|dddd|ddd|dd|d|mm|m|hh|h|ss|s)/i

const patterns = new Map<string, NumberPattern | null>()

/** Splits a section into its digits and the text around them; `null` when it has no digits. */
function parsePattern(section: string): NumberPattern | null {
  let prefix = ''
  let suffix = ''
  let body = ''
  let percent = false
  for (let i = 0; i < section.length; i++) {
    const char = section[i]!
    let text: string | null = null
    if (char === '"') {
      const close = section.indexOf('"', i + 1)
      const end = close === -1 ? section.length : close
      text = section.slice(i + 1, end)
      i = end
    } else if (char === '\\') text = section[++i] ?? ''
    else if ('0#,.'.includes(char) && !suffix) body += char
    else {
      if (char === '%') percent = true
      text = char
    }
    if (text != null) {
      if (body) suffix += text
      else prefix += text
    }
  }
  if (!/[0#]/.test(body)) return null
  const [whole = '', fraction = ''] = body.split('.')
  return {
    prefix,
    suffix,
    fixed: (fraction.match(/0/g) ?? []).length,
    optional: (fraction.match(/#/g) ?? []).length,
    whole: (whole.match(/0/g) ?? []).length,
    grouping: whole.includes(','),
    percent,
  }
}

function patternOf(section: string) {
  let pattern = patterns.get(section)
  if (pattern === undefined) {
    pattern = parsePattern(section)
    if (patterns.size > 200) patterns.clear()
    patterns.set(section, pattern)
  }
  return pattern
}

function groupDigits(digits: string) {
  let out = ''
  for (let i = 0; i < digits.length; i++) {
    if (i && (digits.length - i) % 3 === 0) out += ','
    out += digits[i]
  }
  return out
}

/** The text of a section without digits, with quotes and `\` marks taken off. */
function literalOf(section: string) {
  return section.replace(
    /"([^"]*)"?|\\(.)/g,
    (_, quoted?: string, escaped?: string) => quoted ?? escaped ?? '',
  )
}

function formatNumber(value: number, format: string) {
  const sections = format.split(';')
  const zero = value === 0 && sections.length > 2
  const negative = value < 0 && sections.length > 1
  const section = sections[zero ? 2 : negative ? 1 : 0]!
  const pattern = patternOf(section)
  if (!pattern) return zero || negative ? literalOf(section) : null
  const digits = pattern.fixed + pattern.optional
  const n = Math.abs(value) * (pattern.percent ? 100 : 1)
  // rounded in decimal, so 1.005 shows as 1.01 rather than 1.00
  const text = String(n).includes('e')
    ? n.toFixed(digits)
    : Number(`${Math.round(Number(`${n}e${digits}`))}e-${digits}`).toFixed(digits)
  let [whole = '0', fraction = ''] = text.split('.')
  // trailing optional digits only show when they aren't 0
  while (fraction.length > pattern.fixed && fraction.endsWith('0')) fraction = fraction.slice(0, -1)
  whole = whole.replace(/^0+/, '').padStart(pattern.whole, '0')
  if (pattern.grouping) whole = groupDigits(whole)
  const sign = value < 0 && !negative && Number(text) !== 0 ? '-' : ''
  const number = fraction ? `${whole}.${fraction}` : whole || (pattern.fixed ? '0' : '')
  return `${sign}${pattern.prefix}${number}${pattern.suffix}`
}

type DateToken = { part: string } | { text: string }

const dateTokens = new Map<string, DateToken[]>()

/** A date format as parts and the text between them. */
function tokensOf(format: string) {
  let tokens = dateTokens.get(format)
  if (tokens) return tokens
  tokens = []
  for (let i = 0; i < format.length;) {
    const char = format[i]!
    if (char === '"') {
      const close = format.indexOf('"', i + 1)
      const end = close === -1 ? format.length : close
      tokens.push({ text: format.slice(i + 1, end) })
      i = end + 1
      continue
    }
    if (char === '\\') {
      tokens.push({ text: format[i + 1] ?? '' })
      i += 2
      continue
    }
    const part = DATE_PART.exec(format.slice(i))?.[0]
    if (part) {
      tokens.push({ part: part.toLowerCase() })
      i += part.length
    } else {
      tokens.push({ text: char })
      i++
    }
  }
  // `m` is minutes right after an hour or right before seconds
  const parts = tokens.filter((t): t is { part: string } => 'part' in t)
  parts.forEach((t, i) => {
    if (t.part[0] !== 'm') return
    if (parts[i - 1]?.part[0] === 'h' || parts[i + 1]?.part[0] === 's')
      t.part = t.part === 'mm' ? 'nn' : 'n'
  })
  if (dateTokens.size > 200) dateTokens.clear()
  dateTokens.set(format, tokens)
  return tokens
}

/** Whether a format has date parts, outside quoted and escaped text. */
export const isDateFormat = (format: string) => /[ymdhs]/i.test(format.replace(/"[^"]*"?|\\./g, ''))

const weekdayNames = new Map<string, Intl.DateTimeFormat>()

function weekday(y: number, m: number, d: number, style: 'short' | 'long', locale?: string) {
  const key = `${locale ?? ''}|${style}`
  let names = weekdayNames.get(key)
  if (!names) {
    try {
      names = new Intl.DateTimeFormat(locale, { weekday: style, timeZone: 'UTC' })
    } catch {
      names = new Intl.DateTimeFormat(undefined, { weekday: style, timeZone: 'UTC' })
    }
    weekdayNames.set(key, names)
  }
  return names.format(new Date(Date.UTC(y, m - 1, d)))
}

function formatDate(value: string, format: string, locale?: string) {
  let y = ''
  let mo = ''
  let d = ''
  let h: string
  let mi: string
  let s: string
  const date = DATE_VALUE.exec(value)
  if (date) [, y = '', mo = '', d = '', h = '00', mi = '00', s = '00'] = date
  else {
    const time = TIME_VALUE.exec(value)
    if (!time) return null
    ;[, h = '00', mi = '00', s = '00'] = time
  }
  let out = ''
  for (const token of tokensOf(format)) {
    if ('text' in token) {
      out += token.text
      continue
    }
    const { part } = token
    // a time has no date to show
    if (!date && 'ymd'.includes(part[0]!)) return null
    switch (part) {
      case 'yyyy':
        out += y
        break
      case 'yy':
        out += y.slice(2)
        break
      case 'mm':
        out += mo
        break
      case 'm':
        out += Number(mo)
        break
      case 'dddd':
      case 'ddd':
        out += weekday(+y, +mo, +d, part === 'ddd' ? 'short' : 'long', locale)
        break
      case 'dd':
        out += d
        break
      case 'd':
        out += Number(d)
        break
      case 'hh':
        out += h
        break
      case 'h':
        out += Number(h)
        break
      case 'nn':
        out += mi
        break
      case 'n':
        out += Number(mi)
        break
      case 'ss':
        out += s
        break
      default:
        out += Number(s)
    }
  }
  return out
}

/** Up to 15 significant digits, so 0.1 + 0.2 shows as 0.3. */
export function generalNumber(value: number) {
  if (!Number.isFinite(value)) return String(value)
  const rounded = Number(value.toPrecision(15))
  const abs = Math.abs(rounded)
  if (abs !== 0 && (abs >= 1e15 || abs < 1e-9)) return rounded.toExponential().replace('e+', 'E+')
  return String(rounded)
}

/**
 * A value as the cell shows it, with its format. `locale` names the
 * language for weekdays (`ddd`, `dddd`).
 */
export function formatValue(
  value: SheetValue | undefined,
  format?: string,
  locale?: string,
): string {
  if (value == null) return ''
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
  if (format === '@') return String(value)
  if (typeof value === 'number') {
    if (format && !isDateFormat(format)) {
      const text = formatNumber(value, format)
      if (text != null) return text
    }
    return generalNumber(value)
  }
  if (format && isDateFormat(format)) return formatDate(value, format, locale) ?? value
  return textOf(value)
}

/** Text as it shows: `'=…` is text starting with `=`, shown without its mark. */
export const textOf = (value: string) => (value.startsWith("'=") ? value.slice(1) : value)

/**
 * A number without a format, in at most `chars` characters, for a cell
 * too narrow for all its digits: fewer decimals first, then `1.2E+11`.
 * Only what the cell shows changes, never the value.
 */
export function fitNumber(value: number, chars: number) {
  const text = generalNumber(value)
  if (text.length <= chars || !Number.isFinite(value)) return text
  if (!text.includes('E')) {
    const point = text.indexOf('.')
    // the whole part fits: round off decimals
    if (point !== -1 && point <= chars) {
      const decimals = Math.max(0, chars - point - 1)
      const rounded = String(Number(value.toFixed(decimals)))
      if (rounded.length <= chars && rounded !== '0' && rounded !== '-0') return rounded
    }
  }
  let shortest = text
  for (let digits = 14; digits >= 0; digits--) {
    const [mantissa, exponent] = value.toExponential(digits).split('e')
    const out = `${mantissa!.includes('.') ? mantissa!.replace(/\.?0+$/, '') : mantissa}E${exponent}`
    shortest = out
    if (out.length <= chars) return out
  }
  return shortest
}

/**
 * A number format with `by` more digits after the point, or fewer when
 * `by` is below 0, as the toolbar's buttons change it: `0.00` → `0.000`,
 * `#,##0` → `#,##0.0`, `0.0%` → `0%`. Without a format it starts from the
 * digits `value` shows. Date, time and text formats stay as they are.
 */
export function changeDecimals(
  format: string | undefined,
  value: SheetValue,
  by: number,
): string | undefined {
  if (!format) {
    const text = typeof value === 'number' ? generalNumber(value) : ''
    const point = text.includes('E') ? -1 : text.indexOf('.')
    const digits = Math.max(0, (point === -1 ? 0 : text.length - point - 1) + by)
    return digits ? `0.${'0'.repeat(digits)}` : '0'
  }
  if (format === '@' || isDateFormat(format)) return format
  return format
    .split(';')
    .map((section) => sectionDecimals(section, by))
    .join(';')
}

/** One section of a number format with more or fewer digits after the point. */
function sectionDecimals(section: string, by: number) {
  let start = -1
  for (let i = 0; i < section.length; i++) {
    const char = section[i]!
    if (char === '"') {
      const close = section.indexOf('"', i + 1)
      i = close === -1 ? section.length : close
    } else if (char === '\\') i++
    else if (char === '0' || char === '#') {
      start = i
      break
    }
  }
  if (start === -1) return section
  let end = start
  while (end < section.length && '0#,.'.includes(section[end]!)) end++
  const [whole = '', fraction = ''] = section.slice(start, end).split('.')
  const digits =
    by > 0 ? fraction + '0'.repeat(by) : fraction.slice(0, Math.max(0, fraction.length + by))
  return section.slice(0, start) + (digits ? `${whole}.${digits}` : whole) + section.slice(end)
}

/**
 * How a value lines up in its cell unless its style says otherwise:
 * numbers, dates and times to the right, `TRUE` and `FALSE` in the middle,
 * text to the left.
 */
export function alignOf(value: SheetValue | undefined): 'left' | 'center' | 'right' {
  if (typeof value === 'number') return 'right'
  if (typeof value === 'boolean') return 'center'
  if (typeof value === 'string' && (DATE_VALUE.test(value) || TIME_VALUE.test(value)))
    return 'right'
  return 'left'
}

const NUMBER = /^[-+]?(?:\d{1,3}(?:,\d{3})+|\d+)?(?:\.\d+)?(?:e[-+]?\d+)?$/i
const PLAIN_NUMBER = /^(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?$/
const TYPED_DATE = /^(\d{4})([-/.])(\d{1,2})\2(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
const TYPED_TIME = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/
const CURRENCY = /^([-+]?)([¥$€£])\s?([-+]?)(.+)$/

/** What typing `text` into a cell writes: the value, and a format when the text implies one. */
export interface SheetInput {
  value: SheetValue
  format?: string
}

const pad = (n: string) => n.padStart(2, '0')

/** A date part's format letter, doubled when it was typed with a leading zero. */
const two = (part: string, letter: string) => (part.startsWith('0') ? letter + letter : letter)

/** `HH:mm[:ss]` and the format that shows it as typed, or `null` when it isn't a time. */
function readTime(h: string, m: string, s?: string) {
  if (Number(h) > 23 || Number(m) > 59 || (s != null && Number(s) > 59)) return null
  const value = `${pad(h)}:${m}${s != null ? `:${s}` : ''}`
  // `hh` only when the hour was typed with its zero: `9:30` and `12:30` are `h:mm`
  const format = `${h.startsWith('0') ? 'hh' : 'h'}:mm${s != null ? ':ss' : ''}`
  return { value, format, canonical: h.length === 2 }
}

/**
 * Reads typed text: numbers (with thousands commas, `12%`, `¥1,200.50`),
 * `TRUE` and `FALSE`, dates (`2026-10-31`, `2026/3/5`, `2026.3.5`, with a
 * time or not), times (`9:30`), formulas (`=…`) and text. A leading `'`
 * keeps the rest as text. Dates and times are written the standard way
 * (`2026-03-05`, `09:30`); when typed another way, the format shows them
 * as typed.
 */
export function parseInput(text: string): SheetInput {
  if (text === '') return { value: null }
  // text that starts with `=` keeps its mark, so it isn't a formula
  if (text.startsWith("'")) return { value: text.startsWith("'=") ? text : text.slice(1) }
  if (text.startsWith('=') && text.length > 1) return { value: text }
  const trimmed = text.trim()
  if (/^\S/.test(trimmed) && trimmed !== '.' && /\d/.test(trimmed)) {
    if (NUMBER.test(trimmed)) return { value: Number(trimmed.replaceAll(',', '')) }
    if (trimmed.endsWith('%') && NUMBER.test(trimmed.slice(0, -1))) {
      const n = Number(trimmed.slice(0, -1).replaceAll(',', '')) / 100
      const decimals = /\.(\d+)%$/.exec(trimmed)?.[1]!.length ?? 0
      const format = decimals ? `0.${'0'.repeat(decimals)}%` : '0%'
      return { value: Number(n.toPrecision(15)), format }
    }
    const money = CURRENCY.exec(trimmed)
    if (money && !(money[1] && money[3])) {
      const [, before, symbol, after, digits] = money
      const number = PLAIN_NUMBER.exec(digits!)
      if (number) {
        const n = Number(digits!.replaceAll(',', ''))
        const decimals = number[1]?.length ?? 0
        return {
          value: (before || after) === '-' ? -n : n,
          format: `${symbol}#,##0${decimals ? `.${'0'.repeat(decimals)}` : ''}`,
        }
      }
    }
    const date = TYPED_DATE.exec(trimmed)
    if (date) {
      const [, y, sep, m, d, h, mi, s] = date
      const day = `${y}-${pad(m!)}-${pad(d!)}`
      const time = h != null ? readTime(h, mi!, s) : null
      if (validDate(day) && (h == null || time)) {
        // two digits only where they were typed with a zero: `2026/12/5` is `yyyy/m/d`
        const dayFormat = `yyyy${sep}${two(m!, 'm')}${sep}${two(d!, 'd')}`
        const canonical =
          sep === '-' && m!.length === 2 && d!.length === 2 && (!time || time.canonical)
        const value = time ? `${day} ${time.value}` : day
        return canonical
          ? { value }
          : { value, format: time ? `${dayFormat} ${time.format}` : dayFormat }
      }
    }
    const clock = TYPED_TIME.exec(trimmed)
    if (clock) {
      const time = readTime(clock[1]!, clock[2]!, clock[3])
      if (time)
        return time.canonical ? { value: time.value } : { value: time.value, format: time.format }
    }
  }
  if (/^true$/i.test(trimmed)) return { value: true }
  if (/^false$/i.test(trimmed)) return { value: false }
  return { value: text }
}

function validDate(iso: string) {
  const date = new Date(`${iso}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(iso)
}

/** The text a cell's editor starts with: what was typed, so editing it changes nothing. */
export function inputText(value: SheetValue | undefined): string {
  if (value == null) return ''
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
  if (typeof value === 'number') return generalNumber(value)
  // text that would read as something else keeps its mark
  if (value !== '' && !value.startsWith('=') && parseInput(value).value !== value)
    return `'${value}`
  return value
}
