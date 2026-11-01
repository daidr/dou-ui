import { describe, expect, it, vi } from 'vitest'
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

  it('starts on the first listed weekday when start is not one, and counts from there', () => {
    const event: RepeatingEvent = {
      id: 'x',
      title: '健身',
      // a Sunday
      start: '2026-11-01 19:00',
      repeat: { every: 'week', weekdays: [2, 4], count: 3 },
    }
    expect(starts([event], '2026-11-01', '2026-11-30')).toEqual([
      '2026-11-03 19:00',
      '2026-11-05 19:00',
      '2026-11-10 19:00',
    ])
  })

  it('weekStart decides which weeks are every other one', () => {
    const rule = { every: 'week', interval: 2, weekdays: [0, 1] } as const
    // a Monday: with Sunday-start weeks, the Sunday before is in its week but before start
    const sunday: RepeatingEvent = { id: 'a', title: '复盘', start: '2026-11-02', repeat: rule }
    expect(starts([sunday], '2026-11-01', '2026-11-22')).toEqual([
      '2026-11-02',
      '2026-11-15',
      '2026-11-16',
    ])
    // with Monday-start weeks, the Sunday after start is in the first week
    const monday: RepeatingEvent = {
      id: 'b',
      title: '复盘',
      start: '2026-11-02',
      repeat: { ...rule, weekStart: 1 },
    }
    expect(starts([monday], '2026-11-01', '2026-11-22')).toEqual([
      '2026-11-02',
      '2026-11-08',
      '2026-11-16',
      '2026-11-22',
    ])
  })

  it('jumps to the range instead of counting up from a series that began long ago', () => {
    const old: RepeatingEvent[] = [
      { id: 'd', title: '日', start: '1900-01-01 08:00', repeat: { every: 'day' } },
      {
        id: 'w',
        title: '周',
        start: '1900-01-01 09:00',
        repeat: { every: 'week', weekdays: [1, 3, 5], interval: 3 },
      },
      { id: 'm', title: '月', start: '1900-01-30', repeat: { every: 'month' } },
    ]
    const begun = performance.now()
    const out = expandRepeats(old, '2026-11-01', '2026-11-30')
    expect(performance.now() - begun).toBeLessThan(50)
    expect(out.filter((event) => event.id.startsWith('d@'))).toHaveLength(30)
    expect(out.find((event) => event.id.startsWith('m@'))?.start).toBe('2026-11-30')
    // the same occurrences as counting up day by day would give
    const weekly = out.filter((event) => event.id.startsWith('w@')).map((event) => event.start)
    const near = expandRepeats(
      [{ ...old[1]!, repeat: { ...old[1]!.repeat!, until: '2026-11-30' } }],
      '2026-10-01',
      '2026-11-30',
    ).filter((event) => event.start >= '2026-11-01')
    expect(near.map((event) => event.start)).toEqual(weekly)
    // count works out the number of earlier occurrences without visiting them
    const counted: RepeatingEvent = {
      id: 'c',
      title: '次',
      start: '2026-01-01',
      repeat: { every: 'day', interval: 2, count: 160 },
    }
    expect(starts([counted], '2026-11-01', '2026-11-30')).toEqual([
      // the 153rd to the 160th
      '2026-11-01',
      '2026-11-03',
      '2026-11-05',
      '2026-11-07',
      '2026-11-09',
      '2026-11-11',
      '2026-11-13',
      '2026-11-15',
    ])
  })

  it('warns once about a rule it cannot follow as written', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const bad: RepeatingEvent = {
      id: 'bad',
      title: '错',
      start: '2026-11-02',
      repeat: { every: 'week', weekdays: [7], interval: 0 },
    }
    expect(expandRepeats([bad], '2026-11-01', '2026-11-30')).toEqual([])
    expandRepeats([bad], '2026-11-01', '2026-11-30')
    expect(warn).toHaveBeenCalledTimes(2)
    expect(warn.mock.calls.map((call) => String(call[0])).join('\n')).toMatch(
      /interval 0[\s\S]*weekdays \[7\]/,
    )
    warn.mockRestore()
  })

  it('reads an occurrence id back', () => {
    expect(occurrenceOf('s@2026-10-28')).toEqual({ id: 's', date: '2026-10-28' })
    expect(occurrenceOf('a@b@2026-10-28')).toEqual({ id: 'a@b', date: '2026-10-28' })
    expect(occurrenceOf('s')).toBeNull()
  })
})
