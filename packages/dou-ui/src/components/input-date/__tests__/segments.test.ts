import { describe, expect, it } from 'vitest'
import {
  bounds,
  emptyFields,
  fitsKind,
  fromValue,
  parsePattern,
  stepValue,
  toValue,
  typeDigit,
} from '../segments'

describe('segments', () => {
  it('cuts a pattern into parts and keeps bracketed text', () => {
    expect(parsePattern('YYYY[年]MM[月]DD[日]')).toEqual([
      { type: 'year', token: 'YYYY' },
      { type: 'literal', text: '年' },
      { type: 'month', token: 'MM' },
      { type: 'literal', text: '月' },
      { type: 'day', token: 'DD' },
      { type: 'literal', text: '日' },
    ])
    expect(parsePattern('hh:mm A').map((part) => part.type)).toEqual([
      'hour',
      'literal',
      'minute',
      'literal',
      'meridiem',
    ])
  })

  it('checks that a pattern has what a value needs', () => {
    expect(fitsKind(parsePattern('DD.MM.YYYY'), 'date', false)).toBe(true)
    expect(fitsKind(parsePattern('YYYY-MM'), 'date', false)).toBe(false)
    expect(fitsKind(parsePattern('HH:mm'), 'time', true)).toBe(false)
    expect(fitsKind(parsePattern('hh:mm'), 'time', false)).toBe(false)
    expect(fitsKind(parsePattern('hh:mm A'), 'time', false)).toBe(true)
  })

  it('types digits the way a native field does', () => {
    const month = bounds('month', emptyFields(), false)
    expect(typeDigit('month', '', '1', month)).toEqual({ buffer: '1', value: 1, done: false })
    expect(typeDigit('month', '1', '2', month)).toEqual({ buffer: '12', value: 12, done: true })
    // 13 is no month: the 3 starts over, and nothing can follow it
    expect(typeDigit('month', '1', '3', month)).toEqual({ buffer: '3', value: 3, done: true })
    expect(typeDigit('month', '', '0', month)).toEqual({ buffer: '0', value: null, done: false })
    const year = bounds('year', emptyFields(), false)
    expect(typeDigit('year', '202', '6', year).done).toBe(true)
    expect(typeDigit('year', '20', '2', year).done).toBe(false)
  })

  it('bounds the day by the month and year', () => {
    expect(bounds('day', { ...emptyFields(), month: 2 }, false)).toEqual([1, 29])
    expect(bounds('day', { ...emptyFields(), year: 2026, month: 2 }, false)).toEqual([1, 28])
    expect(bounds('hour', emptyFields(), true)).toEqual([1, 12])
  })

  it('steps and wraps, on the grid of a step', () => {
    expect(stepValue('month', 12, 1, [1, 12])).toBe(1)
    expect(stepValue('month', 1, -1, [1, 12])).toBe(12)
    expect(stepValue('year', 9999, 1, [1, 9999])).toBe(9999)
    expect(stepValue('minute', 50, 1, [0, 59], 15)).toBe(0)
    expect(stepValue('minute', 20, -1, [0, 59], 15)).toBe(15)
    expect(stepValue('minute', 30, -1, [0, 59], 15)).toBe(15)
    expect(stepValue('minute', null, -1, [0, 59], 15)).toBe(45)
  })

  it('turns parts into values and back', () => {
    const fields = fromValue('datetime', '2026-10-29 21:05', true)
    expect(fields).toMatchObject({
      year: 2026,
      month: 10,
      day: 29,
      hour: 9,
      minute: 5,
      meridiem: 1,
    })
    expect(toValue('datetime', fields, false, true)).toBe('2026-10-29 21:05')
    expect(toValue('time', fromValue('time', '00:30', true), false, true)).toBe('00:30')
    expect(toValue('date', { ...emptyFields(), year: 2026, month: 10 }, false, false)).toBeNull()
    expect(toValue('month', { ...emptyFields(), year: 2026, month: 3 }, false, false)).toBe(
      '2026-03',
    )
  })
})
