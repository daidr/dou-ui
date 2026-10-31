import { describe, expect, it } from 'vitest'
import { offTime, resolveCalendar, workdaysBetween, workingMinutes } from '../core/calendar'
import { roundedPath, routeLink } from '../core/geometry'
import { linkRefusal, linkTypeOf, parseLag } from '../core/links'
import { spanOf, writeSpan } from '../core/model'
import { levelOf, unitStart, unitsBetween } from '../core/scale'
import { formatTime, parseTime } from '../core/time'
import { buildTree } from '../core/tree'

const at = (text: string) => parseTime(text)!.at
const DAY = 1440

describe('time', () => {
  it('reads dates and times to the minute, and refuses the rest', () => {
    expect(parseTime('2026-03-05')).toEqual({ at: at('2026-03-05 00:00'), dateOnly: true })
    expect(parseTime('2026-03-05 09:30')!.at - at('2026-03-05')).toBe(570)
    expect(parseTime('2026-03-05 09:30:45')).toEqual(parseTime('2026-03-05 09:30'))
    expect(parseTime('2026-02-30')).toBeNull()
    expect(parseTime('2026-3-5')).toBeNull()
    expect(parseTime(undefined)).toBeNull()
  })

  it('writes what it reads', () => {
    expect(formatTime(at('2026-12-31 23:45'))).toBe('2026-12-31 23:45')
    expect(formatTime(at('2026-01-02'), true)).toBe('2026-01-02')
  })
})

describe('spans', () => {
  it('counts a date-only end as its whole day', () => {
    const span = spanOf({ id: 'a', title: '', start: '2026-03-02', end: '2026-03-06' })!
    expect(span.end - span.start).toBe(5 * DAY)
    expect(span.dateOnly).toBe(true)
  })

  it('takes a timed end as the moment it ends, and defaults short tasks', () => {
    const timed = spanOf({
      id: 'a',
      title: '',
      start: '2026-03-05 14:00',
      end: '2026-03-05 16:30',
    })!
    expect(timed.end - timed.start).toBe(150)
    expect(timed.dateOnly).toBe(false)
    expect(spanOf({ id: 'b', title: '', start: '2026-03-05' })!.end).toBe(at('2026-03-06'))
    expect(spanOf({ id: 'c', title: '', start: '2026-03-05 09:00' })!.end).toBe(
      at('2026-03-05 10:00'),
    )
    expect(spanOf({ id: 'd', title: '' })).toBeNull()
  })

  it('puts a date-only milestone in the middle of its day', () => {
    const span = spanOf({ id: 'm', title: '', type: 'milestone', start: '2026-03-05' })!
    expect(span.start).toBe(span.end)
    expect(span.start).toBe(at('2026-03-05 12:00'))
  })

  it('writes dates back in the task’s own style', () => {
    const task = { id: 'a', title: '', start: '2026-03-02', end: '2026-03-06' }
    expect(writeSpan(task, at('2026-03-03'), at('2026-03-10'))).toEqual({
      start: '2026-03-03',
      end: '2026-03-09',
    })
    expect(writeSpan(task, at('2026-03-03 10:00'), at('2026-03-10'))).toEqual({
      start: '2026-03-03 10:00',
      end: '2026-03-10 00:00',
    })
    const milestone = { id: 'm', title: '', type: 'milestone' as const, start: '2026-03-05' }
    expect(writeSpan(milestone, at('2026-03-08 12:00'), at('2026-03-08 12:00'))).toEqual({
      start: '2026-03-08',
    })
  })
})

describe('calendar', () => {
  // 2026-10-01 is a Thursday
  const calendar = resolveCalendar({
    holidays: ['2026-10-01', '2026-10-02'],
    workdays: ['2026-10-11'],
  })

  it('counts working days with holidays and make-up days', () => {
    expect(workdaysBetween(calendar, at('2026-09-28'), at('2026-10-05'))).toBe(3)
    expect(workdaysBetween(calendar, at('2026-10-10'), at('2026-10-12'))).toBe(1)
  })

  it('counts working hours inside the working day', () => {
    expect(workingMinutes(calendar, at('2026-10-13 14:00'), at('2026-10-14 12:00'))).toBe(
      (4 + 3) * 60,
    )
    expect(workingMinutes(calendar, at('2026-10-01 10:00'), at('2026-10-01 12:00'))).toBe(0)
  })

  it('leaves breaks out of working hours', () => {
    const lunch = resolveCalendar({
      hours: [
        ['13:00', '18:00'],
        ['09:00', '12:00'],
      ],
    })
    expect(workingMinutes(lunch, at('2026-10-13 10:00'), at('2026-10-13 15:00'))).toBe(4 * 60)
    expect(offTime(lunch, at('2026-10-13'), at('2026-10-14'), true)).toEqual([
      { start: at('2026-10-13'), end: at('2026-10-13 09:00') },
      { start: at('2026-10-13 12:00'), end: at('2026-10-13 13:00') },
      { start: at('2026-10-13 18:00'), end: at('2026-10-14') },
    ])
  })

  it('merges time off into stretches', () => {
    const off = offTime(calendar, at('2026-09-28'), at('2026-10-06'))
    expect(off).toEqual([{ start: at('2026-10-01'), end: at('2026-10-05') }])
    const hours = offTime(calendar, at('2026-10-05'), at('2026-10-06'), true)
    expect(hours).toEqual([
      { start: at('2026-10-05'), end: at('2026-10-05 09:00') },
      { start: at('2026-10-05 18:00'), end: at('2026-10-06') },
    ])
  })
})

describe('tree', () => {
  it('orders rows, sums up parents and hides collapsed children', () => {
    const tree = buildTree([
      { id: 'b', title: 'B', order: 'b' },
      { id: 'a', title: 'A', order: 'a', collapsed: true },
      { id: 'a1', parent: 'a', title: 'A1', start: '2026-03-02', end: '2026-03-03', progress: 1 },
      { id: 'a2', parent: 'a', title: 'A2', start: '2026-03-04', end: '2026-03-09' },
      { id: 'm', parent: 'a', title: 'M', type: 'milestone', start: '2026-03-20' },
    ])
    expect(tree.rows.map((row) => row.task.id)).toEqual(['a', 'b'])
    const a = tree.byId.get('a')!
    expect(a.summary).toBe(true)
    expect(a.span!.start).toBe(at('2026-03-02'))
    expect(a.span!.end).toBe(at('2026-03-20 12:00'))
    // two days done out of eight
    expect(a.progress).toBeCloseTo(2 / 8)
    expect(tree.byId.get('a1')!.index).toBe(-1)
  })

  it('cuts parent loops and ignores missing parents', () => {
    const tree = buildTree([
      { id: 'x', parent: 'y', title: 'X' },
      { id: 'y', parent: 'x', title: 'Y' },
      { id: 'z', parent: 'nope', title: 'Z' },
    ])
    expect(tree.rows.map((row) => `${row.task.id}${row.depth}`)).toEqual(['x0', 'y0', 'z0'])
  })
})

describe('scale', () => {
  it('picks the level by day width', () => {
    expect(levelOf(960).name).toBe('hour')
    expect(levelOf(40).name).toBe('day')
    expect(levelOf(16).name).toBe('week')
    expect(levelOf(0.2).name).toBe('year')
  })

  it('finds unit starts', () => {
    // a Wednesday
    const wed = at('2026-10-14 15:00')
    expect(unitStart('week', wed, 1)).toBe(at('2026-10-12'))
    expect(unitStart('week', wed, 0)).toBe(at('2026-10-11'))
    expect(unitStart('quarter', wed)).toBe(at('2026-10-01'))
    expect(unitStart('hour', wed, 1, 6)).toBe(at('2026-10-14 12:00'))
    expect(unitsBetween('month', at('2026-11-15'), at('2027-01-02')).length).toBe(3)
  })
})

describe('links', () => {
  const row = 36
  it('takes one vertical run when the next task starts later', () => {
    const route = routeLink(
      { left: 0, right: 100, y: 18 },
      { left: 160, right: 200, y: 54 },
      'fs',
      row,
    )
    expect(route.points).toEqual([
      { x: 100, y: 18 },
      { x: 112, y: 18 },
      { x: 112, y: 54 },
      { x: 160, y: 54 },
    ])
    expect(route.direction).toBe(1)
  })

  it('turns back between the rows when the tasks overlap', () => {
    const route = routeLink(
      { left: 0, right: 100, y: 18 },
      { left: 90, right: 200, y: 54 },
      'fs',
      row,
    )
    expect(route.points.map((p) => p.y)).toEqual([18, 18, 36, 36, 54, 54])
    expect(route.points[3]!.x).toBe(78)
  })

  it('enters the end of the task for finish-to-finish', () => {
    const route = routeLink(
      { left: 0, right: 100, y: 18 },
      { left: 20, right: 60, y: 54 },
      'ff',
      row,
    )
    expect(route.tip).toEqual({ x: 60, y: 54 })
    expect(route.direction).toBe(-1)
    expect(route.points[1]!.x).toBe(112)
  })

  it('rounds corners without overshooting short segments', () => {
    expect(
      roundedPath(
        [
          { x: 0, y: 0 },
          { x: 4, y: 0 },
          { x: 4, y: 10 },
        ],
        4,
      ),
    ).toBe('M0 0 L2 0 Q4 0 4 2 L4 10')
  })
})

describe('link rules', () => {
  const tasks = new Map(
    [
      { id: 'p', title: '' },
      { id: 'a', parent: 'p', title: '' },
      { id: 'b', title: '' },
      { id: 'c', title: '' },
    ].map((task) => [task.id, task]),
  )
  const links = [
    { id: '1', from: 'a', to: 'b' },
    { id: '2', from: 'b', to: 'c' },
  ]

  it('refuses self, nested, duplicate and cyclic links', () => {
    expect(linkRefusal(tasks, links, 'a', 'a')).toBe('self')
    expect(linkRefusal(tasks, links, 'p', 'a')).toBe('nested')
    expect(linkRefusal(tasks, links, 'b', 'a')).toBe('duplicate')
    expect(linkRefusal(tasks, links, 'c', 'a')).toBe('cycle')
    expect(linkRefusal(tasks, links, 'a', 'c')).toBeNull()
  })

  it('names the type by the ends joined', () => {
    expect(linkTypeOf('end', 'start')).toBe('fs')
    expect(linkTypeOf('start', 'start')).toBe('ss')
    expect(linkTypeOf('end', 'end')).toBe('ff')
    expect(linkTypeOf('start', 'end')).toBe('sf')
  })

  it('reads lags in days, hours and minutes', () => {
    expect(parseLag(2)).toEqual({ amount: 2, unit: 'day' })
    expect(parseLag('2d')).toEqual({ amount: 2, unit: 'day' })
    expect(parseLag('4h')).toEqual({ amount: 240, unit: 'minute' })
    expect(parseLag('-30m')).toEqual({ amount: -30, unit: 'minute' })
    expect(parseLag(undefined)).toEqual({ amount: 0, unit: 'day' })
    expect(parseLag('soon')).toBeNull()
  })
})
