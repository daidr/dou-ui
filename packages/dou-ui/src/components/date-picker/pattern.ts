/**
 * Show a date value through a display pattern such as `MM/DD/YYYY`, and
 * read typed text back through the same pattern. Values stay `YYYY-MM-DD`,
 * `YYYY-MM` or `YYYY`; only the text in the field changes.
 */
import { parsePattern } from '../input-date/segments'
import type { Part } from '../input-date/segments'
import { parseDate } from './date'
import type { DateUnit } from './date'

type PatternUnit = Exclude<DateUnit, 'week'>

const NEEDS: Record<PatternUnit, string[]> = {
  date: ['year', 'month', 'day'],
  month: ['year', 'month'],
  year: ['year'],
}

/** The pattern's parts, or `null` when it lacks a part the unit needs or has a time in it. */
export function datePattern(pattern: string, unit: PatternUnit): Part[] | null {
  const parts = parsePattern(pattern)
  const types = new Set(parts.map((part) => part.type))
  if (!NEEDS[unit].every((type) => types.has(type as Part['type']))) return null
  if (['hour', 'minute', 'second', 'meridiem'].some((type) => types.has(type as Part['type'])))
    return null
  return parts
}

export function formatWith(value: string, parts: Part[]): string {
  const [year = '', month = '', day = ''] = value.split('-')
  return parts
    .map((part) => {
      if (part.type === 'literal') return part.text
      if (part.type === 'year') return year
      if (part.type === 'month') return month
      if (part.type === 'day') return day
      return ''
    })
    .join('')
}

const escape = (text: string) => text.replace(/[$()*+.?[\\\]^{|}-]/g, '\\$&')

/**
 * Read the start of `text` through the pattern. Returns the value and
 * whatever follows it (a time, for a date with a time), or `null`.
 * Single-digit months and days are fine, and any run of spaces matches.
 */
export function parseWith(
  text: string,
  parts: Part[],
  unit: PatternUnit,
): { value: string; rest: string } | null {
  const order: string[] = []
  const source = parts
    .map((part) => {
      if (part.type === 'literal') return escape(part.text.trim()).replace(/\s+/g, '\\s*') + '\\s*'
      order.push(part.type)
      return part.type === 'year' ? '(\\d{4})\\s*' : '(\\d{1,2})\\s*'
    })
    .join('')
  const match = new RegExp(`^\\s*${source}`).exec(text)
  if (!match) return null
  const found: Record<string, string> = {}
  order.forEach((type, index) => (found[type] = match[index + 1]!))
  const iso = [found.year, found.month, found.day].filter(Boolean).join('-')
  const value = parseDate(iso, unit)
  return value ? { value, rest: text.slice(match[0].length) } : null
}
