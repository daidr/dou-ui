import { describe, expect, it } from 'vitest'
import {
  addDays,
  addMonths,
  daysInMonth,
  expand,
  inBounds,
  isoWeek,
  parseDate,
  quarterOf,
  truncate,
  unitOf,
  weekday,
} from '../date'

describe('date helpers', () => {
  it('does calendar arithmetic on strings', () => {
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01')
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonths('2026-03-15', -14)).toBe('2025-01-15')
    expect(daysInMonth(2024, 2)).toBe(29)
    expect(weekday('2026-10-28')).toBe(3)
  })

  it('parses typed text by unit', () => {
    expect(parseDate('2026-10-28', 'date')).toBe('2026-10-28')
    expect(parseDate('2026/1/5', 'date')).toBe('2026-01-05')
    expect(parseDate('2026.02.30', 'date')).toBeNull()
    expect(parseDate('2026-10', 'date')).toBeNull()
    expect(parseDate('2026-7', 'month')).toBe('2026-07')
    expect(parseDate('2026', 'year')).toBe('2026')
    expect(parseDate('hello', 'date')).toBeNull()
  })

  it('handles quarters', () => {
    expect(quarterOf('2026-10-28')).toBe('2026-Q4')
    expect(truncate('2026-03-31', 'quarter')).toBe('2026-Q1')
    expect(expand('2026-Q3')).toBe('2026-07-01')
    expect(unitOf('2026-Q2')).toBe('quarter')
    expect(unitOf('2026-02')).toBe('month')
    expect(parseDate('2026-Q4', 'quarter')).toBe('2026-Q4')
    expect(parseDate('2026 q2', 'quarter')).toBe('2026-Q2')
    expect(parseDate('Q1 2027', 'quarter')).toBe('2027-Q1')
    expect(parseDate('2026-Q5', 'quarter')).toBeNull()
    expect(inBounds('2026-Q3', '2026-08-01')).toBe(true)
    expect(inBounds('2026-Q2', '2026-08-01')).toBe(false)
  })

  it('checks bounds at the unit of the value', () => {
    expect(inBounds('2026-10-01', '2026-10-15')).toBe(false)
    expect(inBounds('2026-10', '2026-10-15')).toBe(true)
    expect(inBounds('2026-09', '2026-10-15')).toBe(false)
    expect(inBounds('2027', undefined, '2026-12-31')).toBe(false)
  })
  it('names ISO weeks', () => {
    expect(isoWeek('2026-10-28')).toBe('2026-W44')
    // 2027-01-01 is a Friday, so it still belongs to the last week of 2026
    expect(isoWeek('2027-01-01')).toBe('2026-W53')
    expect(isoWeek('2024-12-30')).toBe('2025-W01')
    expect(expand('2026-W44')).toBe('2026-10-26')
    expect(expand('2025-W01')).toBe('2024-12-30')
    expect(parseDate('2026-W44', 'week')).toBe('2026-W44')
    expect(parseDate('2026 7', 'week')).toBe('2026-W07')
    expect(parseDate('2025-W53', 'week')).toBeNull()
    expect(inBounds('2026-W44', '2026-10-28')).toBe(true)
    expect(inBounds('2026-W43', '2026-10-28')).toBe(false)
  })
})
