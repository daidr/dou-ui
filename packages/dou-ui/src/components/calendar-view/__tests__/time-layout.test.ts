import { describe, expect, it } from 'vitest'
import { layoutDay, readMoment, segmentOn, spanOf, toMinutes } from '../time-layout'

const at = (time: string, endTime?: string, title = time) => {
  const event = {
    start: `2026-10-28 ${time}`,
    end: endTime && `2026-10-28 ${endTime}`,
    title,
  }
  return { event, ...segmentOn(spanOf(event)!, '2026-10-28') }
}

describe('spanOf', () => {
  it('reads dates and times, rejecting anything else', () => {
    expect(readMoment('2026-10-28')).toEqual({ date: '2026-10-28', minutes: null })
    expect(readMoment('2026-10-28 09:30')).toEqual({ date: '2026-10-28', minutes: 570 })
    expect(readMoment('2026-10-28T09:30:15')).toEqual({ date: '2026-10-28', minutes: 570 })
    expect(readMoment('2026-02-30')).toBeNull()
    expect(readMoment('2026-10-28 24:00')).toBeNull()
    expect(readMoment('10/28')).toBeNull()
  })

  it('spans the days of an all-day event, ignoring an end before the start', () => {
    expect(spanOf({ start: '2026-10-20', end: '2026-10-22', title: 'a' })).toMatchObject({
      from: '2026-10-20',
      to: '2026-10-22',
      start: null,
    })
    expect(spanOf({ start: '2026-10-20', end: '2026-10-18', title: 'a' })!.to).toBe('2026-10-20')
    expect(spanOf({ start: '2026-10-20', end: '2026-10-22 00:00', title: 'a' })!.to).toBe(
      '2026-10-21',
    )
    expect(spanOf({ start: 'soon', title: 'a' })).toBeNull()
  })

  it('cuts a timed event at midnight into one part per day', () => {
    const span = spanOf({ start: '2026-10-28 22:00', end: '2026-10-30 08:00', title: 'a' })!
    expect([span.from, span.to, span.start, span.end]).toEqual([
      '2026-10-28',
      '2026-10-30',
      1320,
      480,
    ])
    expect(segmentOn(span, '2026-10-28')).toEqual({ start: 1320, end: 1440 })
    expect(segmentOn(span, '2026-10-29')).toEqual({ start: 0, end: 1440 })
    expect(segmentOn(span, '2026-10-30')).toEqual({ start: 0, end: 480 })
  })

  it('ends at midnight on the same day, and an hour later by default', () => {
    const midnight = spanOf({ start: '2026-10-28 22:00', end: '2026-10-29 00:00', title: 'a' })!
    expect([midnight.to, midnight.end]).toEqual(['2026-10-28', 1440])
    const late = spanOf({ start: '2026-10-28 23:30', title: 'a' })!
    expect([late.to, late.end]).toEqual(['2026-10-29', 30])
    const dateOnlyEnd = spanOf({ start: '2026-10-28 22:00', end: '2026-10-29', title: 'a' })!
    expect([dateOnlyEnd.to, dateOnlyEnd.end]).toEqual(['2026-10-29', 1440])
  })
})

describe('layoutDay', () => {
  it('reads HH:mm and rejects anything else', () => {
    expect(toMinutes('09:30')).toBe(570)
    expect(toMinutes('24:00')).toBe(1440)
    expect(toMinutes('nine')).toBeNull()
    expect(toMinutes(undefined)).toBeNull()
  })

  it('defaults to an hour and keeps very short events readable', () => {
    const [plain, tiny] = layoutDay([at('09:00'), at('12:00', '12:05')])
    expect([plain!.start, plain!.end]).toEqual([540, 600])
    expect(tiny!.end - tiny!.start).toBe(15)
  })

  it('puts overlapping events side by side and reuses free columns', () => {
    const placed = layoutDay([
      at('14:00', '15:30', 'a'),
      at('14:30', '16:00', 'b'),
      at('15:30', '16:30', 'c'),
      at('18:00', '19:00', 'd'),
    ])
    const by = (title: string) => placed.find((item) => item.event.title === title)!
    expect([by('a').column, by('b').column, by('c').column]).toEqual([0, 1, 0])
    expect([by('a').columns, by('b').columns, by('c').columns]).toEqual([2, 2, 2])
    expect([by('d').column, by('d').columns]).toEqual([0, 1])
  })

  it('widens an event over columns that stay free', () => {
    const placed = layoutDay([
      at('09:00', '12:00', 'long'),
      at('09:00', '10:00', 'first'),
      at('09:30', '10:00', 'second'),
      at('11:00', '12:00', 'later'),
    ])
    const by = (title: string) => placed.find((item) => item.event.title === title)!
    expect(by('long').columns).toBe(3)
    expect(by('later').column).toBe(1)
    expect(by('later').span).toBe(2)
    expect(by('first').span).toBe(1)
  })
})
