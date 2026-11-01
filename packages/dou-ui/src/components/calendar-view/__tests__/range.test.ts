import { describe, expect, it } from 'vitest'
import { visibleRange } from '../../../index'

describe('visibleRange', () => {
  it('gives the days each view shows', () => {
    expect(visibleRange('2027-02-10', 'month', 1)).toEqual({
      start: '2027-02-01',
      end: '2027-03-14',
    })
    expect(visibleRange('2027-02-10', 'month')).toEqual({ start: '2027-01-31', end: '2027-03-13' })
    expect(visibleRange('2026-11-04', 'week', 1)).toEqual({
      start: '2026-11-02',
      end: '2026-11-08',
    })
    expect(visibleRange('2026-11-04', 'day')).toEqual({ start: '2026-11-04', end: '2026-11-04' })
    expect(visibleRange('2026-02-14', 'agenda')).toEqual({ start: '2026-02-01', end: '2026-02-28' })
  })
})
