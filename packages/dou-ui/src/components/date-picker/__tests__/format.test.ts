import { describe, expect, it } from 'vitest'
import { en, formatDateValue, zhCN } from '../../../index'

describe('formatDateValue', () => {
  it('writes a value through the locale’s pattern for its unit', () => {
    expect(formatDateValue('2026-11-01', { locale: en })).toBe('11/01/2026')
    expect(formatDateValue('2026-11', { locale: zhCN })).toBe('2026-11')
    expect(formatDateValue('2026-11-01 09:30', { locale: en, type: 'datetime' })).toBe(
      '11/01/2026 09:30',
    )
  })

  it('takes literals in brackets of a display format', () => {
    expect(
      formatDateValue('2026-11-01', { locale: zhCN, displayFormat: 'YYYY[年]MM[月]DD[日]' }),
    ).toBe('2026年11月01日')
  })

  it('writes quarters with the locale’s text and keeps weeks', () => {
    expect(formatDateValue('2026-Q4', { locale: zhCN, type: 'quarter' })).toBe('2026 年第 4 季度')
    expect(formatDateValue('2026-W05', { locale: zhCN, type: 'week' })).toBe('2026-W05')
  })
})
