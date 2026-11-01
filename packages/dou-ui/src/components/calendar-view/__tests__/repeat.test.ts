import { describe, expect, it } from 'vitest'
import { expandRepeats, occurrenceOf } from '../../../index'
import type { RepeatingEvent } from '../../../index'

const starts = (events: RepeatingEvent[], from: string, to: string) =>
  expandRepeats(events, from, to).map((event) => event.start)

describe('expandRepeats', () => {
  it('repeats daily and weekly at the same time, with interval, until and except', () => {
    const standup: RepeatingEvent = {
      id: 's',
      title: '站会',
      start: '2026-10-26 09:30',
      end: '2026-10-26 09:45',
      repeat: { every: 'week', weekdays: [1, 3, 5], until: '2026-11-06', except: ['2026-10-30'] },
    }
    expect(starts([standup], '2026-10-01', '2026-12-31')).toEqual([
      '2026-10-26 09:30',
      '2026-10-28 09:30',
      '2026-11-02 09:30',
      '2026-11-04 09:30',
      '2026-11-06 09:30',
    ])
    const [first] = expandRepeats([standup], '2026-10-28', '2026-10-28')
    expect(first).toEqual({
      id: 's@2026-10-28',
      title: '站会',
      start: '2026-10-28 09:30',
      end: '2026-10-28 09:45',
    })
    const everyOther: RepeatingEvent = {
      id: 'r',
      title: '复盘',
      start: '2026-10-01',
      repeat: { every: 'day', interval: 3, count: 4 },
    }
    expect(starts([everyOther], '2026-10-01', '2026-10-31')).toEqual([
      '2026-10-01',
      '2026-10-04',
      '2026-10-07',
      '2026-10-10',
    ])
  })

  it('every other week counts weeks from the first one', () => {
    const event: RepeatingEvent = {
      id: 'w',
      title: '双周会',
      start: '2026-10-27 15:00',
      repeat: { every: 'week', interval: 2, weekdays: [2, 4] },
    }
    expect(starts([event], '2026-10-27', '2026-11-12')).toEqual([
      '2026-10-27 15:00',
      '2026-10-29 15:00',
      '2026-11-10 15:00',
      '2026-11-12 15:00',
    ])
  })

  it('skips months without the day, and 29 February outside leap years', () => {
    const rent: RepeatingEvent = {
      id: 'm',
      title: '月底结算',
      start: '2026-01-31',
      repeat: { every: 'month' },
    }
    expect(starts([rent], '2026-01-01', '2026-05-31')).toEqual([
      '2026-01-31',
      '2026-03-31',
      '2026-05-31',
    ])
    const leap: RepeatingEvent = {
      id: 'y',
      title: '闰日',
      start: '2024-02-29',
      repeat: { every: 'year' },
    }
    expect(starts([leap], '2024-01-01', '2028-12-31')).toEqual(['2024-02-29', '2028-02-29'])
  })

  it('keeps occurrences that run into the range and plain events that touch it', () => {
    const trip: RepeatingEvent = {
      id: 't',
      title: '上海出差',
      start: '2026-10-29',
      end: '2026-11-02',
      repeat: { every: 'month' },
    }
    expect(expandRepeats([trip], '2026-11-01', '2026-11-30').map((event) => event.id)).toEqual([
      't@2026-10-29',
      't@2026-11-29',
    ])
    const plain = { id: 'p', title: '发版', start: '2026-11-05' }
    expect(expandRepeats([plain], '2026-11-01', '2026-11-30')).toEqual([plain])
    expect(expandRepeats([plain], '2026-12-01', '2026-12-31')).toEqual([])
  })

  it('reads an occurrence id back', () => {
    expect(occurrenceOf('s@2026-10-28')).toEqual({ id: 's', date: '2026-10-28' })
    expect(occurrenceOf('a@b@2026-10-28')).toEqual({ id: 'a@b', date: '2026-10-28' })
    expect(occurrenceOf('s')).toBeNull()
  })
})
