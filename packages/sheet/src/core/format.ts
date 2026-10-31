import type { SheetValue } from './model'

/*
 * Showing values and reading what is typed into a cell.
 *
 * Number formats are a small, predictable subset of the usual pattern
 * language: digits (`0` always shown, `#` only when needed), a thousands
 * comma, `%`, text before and after (in quotes, or symbols such as `¥`),
 * and a second section after `;` for negative numbers. Date formats use
 * `yyyy`, `yy`, `m`, `mm`, `d`, `dd`, `h`, `hh`, `mm` (minutes, after an
 * hour) and `ss`, and apply to dates written as `YYYY-MM-DD[ HH:mm[:ss]]`.
 * `@` shows the value as text.
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

const DATE_TOKEN = /yyyy|yy|mm|m|dd|d|hh|h|ss|s/gi
const DATE_VALUE = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/

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

function formatNumber(value: number, format: string) {
  const sections = format.split(';')
  const negative = value < 0 && sections.length > 1
  const pattern = patternOf(sections[negative ? 1 : 0]!)
  if (!pattern) return null
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

function formatDate(value: string, format: string) {
  const match = DATE_VALUE.exec(value)
  if (!match) return null
  const [, y, mo, d, h = '00', mi = '00', s = '00'] = match
  let afterHour = false
  return format.replace(DATE_TOKEN, (token) => {
    const lower = token.toLowerCase()
    switch (lower) {
      case 'yyyy':
        return y!
      case 'yy':
        return y!.slice(2)
      case 'mm':
      case 'm': {
        const minute = afterHour
        afterHour = false
        const part = minute ? mi : mo!
        return lower === 'mm' ? part : String(Number(part))
      }
      case 'dd':
        return d!
      case 'd':
        return String(Number(d))
      case 'hh':
      case 'h':
        afterHour = true
        return lower === 'hh' ? h : String(Number(h))
      case 'ss':
        return s
      default:
        return String(Number(s))
    }
  })
}

/** Up to 15 significant digits, so 0.1 + 0.2 shows as 0.3. */
export function generalNumber(value: number) {
  if (!Number.isFinite(value)) return String(value)
  const rounded = Number(value.toPrecision(15))
  const abs = Math.abs(rounded)
  if (abs !== 0 && (abs >= 1e15 || abs < 1e-9)) return rounded.toExponential().replace('e+', 'E+')
  return String(rounded)
}

/** A value as the cell shows it, with its format. */
export function formatValue(value: SheetValue | undefined, format?: string): string {
  if (value == null) return ''
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
  if (format === '@') return String(value)
  if (typeof value === 'number') {
    if (format) {
      const text = formatNumber(value, format)
      if (text != null) return text
    }
    return generalNumber(value)
  }
  if (format && /[ymdhs]/i.test(format)) return formatDate(value, format) ?? value
  return value
}

/** How a value lines up in its cell unless its style says otherwise. */
export function alignOf(value: SheetValue | undefined): 'left' | 'center' | 'right' {
  if (typeof value === 'number') return 'right'
  if (typeof value === 'boolean') return 'center'
  return 'left'
}

const NUMBER = /^[-+]?(?:\d{1,3}(?:,\d{3})+|\d+)?(?:\.\d+)?(?:e[-+]?\d+)?$/i
const SLASH_DATE = /^(\d{4})[/.](\d{1,2})[/.](\d{1,2})$/

/** What typing `text` into a cell writes: the value, and a format when the text implies one. */
export interface SheetInput {
  value: SheetValue
  format?: string
}

/**
 * Reads typed text: numbers (with thousands commas, `12%`), `TRUE` and
 * `FALSE`, dates such as `2026/10/31`, formulas (`=…`) and text. A leading
 * `'` keeps the rest as text.
 */
export function parseInput(text: string): SheetInput {
  if (text === '') return { value: null }
  if (text.startsWith("'")) return { value: text.slice(1) }
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
    const date = SLASH_DATE.exec(trimmed)
    if (date) {
      const [, y, m, d] = date
      const iso = `${y}-${m!.padStart(2, '0')}-${d!.padStart(2, '0')}`
      if (validDate(iso)) return { value: iso }
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
