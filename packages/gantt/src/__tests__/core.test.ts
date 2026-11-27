import { describe, expect, it } from 'vitest'
import {
  endKeepingWork,
  isWorkTime,
  nextWorkTime,
  offTime,
  resolveCalendar,
  shiftWorkdays,
  shiftWorkMinutes,
  startKeepingWork,
  workdaysBetween,
  workingMinutes,
} from '../core/calendar'
import { roundedPath, routeLink } from '../core/geometry'
import { linkRefusal, linkTypeOf, parseLag } from '../core/links'
import { spanOf, writeSpan } from '../core/model'
import {
  DAY_WIDTH_RANGE,
  headerStepFor,
  levelOf,
  minuteStep,
  secondStep,
  snapStep,
  unitStart,
  unitsBetween,
} from '../core/scale'
import { formatTime, parseTime, toTimestamp } from '../core/time'
import { buildTree } from '../core/tree'
import { dateLabel, durationLabel, timedDurationLabel, unitLabel } from '../labels'
import { ganttLocales } from '../locale'

const at = (text: string) => parseTime(text)!.at
const DAY = 1440

describe('time', () => {
  it('reads dates, seconds, milliseconds, ISO offsets and Unix timestamps, and refuses the rest', () => {
    expect(parseTime('2026-03-05')).toEqual({ at: at('2026-03-05 00:00'), dateOnly: true })
    expect(parseTime('2026-03-05 09:30')!.at - at('2026-03-05')).toBe(570)
    expect(parseTime('2026-03-05 09:30:45')!.at - at('2026-03-05 09:30')).toBeCloseTo(0.75, 10)
    expect(parseTime('2026-03-05T09:30:45.250')!.at - at('2026-03-05 09:30:45')).toBeCloseTo(
      0.25 / 60,
      8,
    )
    const ts = new Date(2026, 2, 5, 9, 30, 45, 500).getTime()
    expect(parseTime(ts)).toEqual({ at: at('2026-03-05 09:30:45.500'), dateOnly: false })
    expect(toTimestamp(parseTime(ts)!.at)).toBe(ts)
    const iso = new Date(ts).toISOString()
    expect(parseTime(iso)!.at).toBeCloseTo(parseTime(ts)!.at, 10)
    expect(parseTime('2026-02-30')).toBeNull()
    expect(parseTime('2026-3-5')).toBeNull()
    expect(parseTime(Number.NaN)).toBeNull()
    expect(parseTime(Number.POSITIVE_INFINITY)).toBeNull()
    expect(parseTime(undefined)).toBeNull()
  })

  it('writes what it reads, keeping seconds and milliseconds only when non-zero', () => {
    expect(formatTime(at('2026-12-31 23:45'))).toBe('2026-12-31 23:45')
    expect(formatTime(at('2026-12-31 23:45:00'))).toBe('2026-12-31 23:45')
    expect(formatTime(at('2026-12-31 23:45:12'))).toBe('2026-12-31 23:45:12')
    expect(formatTime(at('2026-12-31 23:45:12.050'))).toBe('2026-12-31 23:45:12.050')
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
    // numeric Unix timestamps stay numeric when moved
    const startTs = new Date(2026, 2, 5, 10, 0, 0).getTime()
    const endTs = new Date(2026, 2, 5, 10, 0, 15).getTime()
    const liveTask = { id: 'live', title: '', start: startTs, end: endTs }
    const span = spanOf(liveTask)!
    expect(span.end - span.start).toBeCloseTo(0.25, 10)
    expect(writeSpan(liveTask, span.start + 0.5, span.end + 0.5)).toEqual({
      start: startTs + 30_000,
      end: endTs + 30_000,
    })
  })
})

describe('calendar', () => {
  it('keeps the working time of a moved span', () => {
    const calendar = resolveCalendar({
      hours: [
        ['09:00', '12:00'],
        ['13:00', '18:00'],
      ],
    })
    // Mon–Fri, five working days, moved to start on Wednesday: ends Tuesday
    const week = { start: at('2026-03-02'), end: at('2026-03-07'), dateOnly: true }
    expect(formatTime(endKeepingWork(calendar, week, at('2026-03-04')))).toBe('2026-03-11 00:00')
    // three working hours (lunch left out), from Friday 16:00, run into Monday
    const hours = { start: at('2026-03-02 09:00'), end: at('2026-03-02 13:00'), dateOnly: false }
    expect(formatTime(endKeepingWork(calendar, hours, at('2026-03-06 16:00')))).toBe(
      '2026-03-09 10:00',
    )
    // a span with no working time keeps its length
    const weekend = { start: at('2026-03-07'), end: at('2026-03-09'), dateOnly: true }
    expect(endKeepingWork(calendar, weekend, at('2026-03-14'))).toBe(at('2026-03-16'))
  })

  it('steps over time off in both directions', () => {
    const calendar = resolveCalendar({
      hours: [
        ['09:00', '12:00'],
        ['13:00', '18:00'],
      ],
    })
    // Friday 17:00 back three working hours: 14:00; forward: Monday 11:00
    expect(formatTime(shiftWorkMinutes(calendar, at('2026-03-06 17:00'), -180))).toBe(
      '2026-03-06 14:00',
    )
    expect(formatTime(shiftWorkMinutes(calendar, at('2026-03-06 17:00'), 180))).toBe(
      '2026-03-09 11:00',
    )
    // back two working days from Monday: Thursday
    expect(formatTime(shiftWorkdays(calendar, at('2026-03-09'), -2), true)).toBe('2026-03-05')
    expect(formatTime(nextWorkTime(calendar, at('2026-03-06 12:30'), false))).toBe(
      '2026-03-06 13:00',
    )
    expect(formatTime(nextWorkTime(calendar, at('2026-03-07 10:00'), true), true)).toBe(
      '2026-03-09',
    )
    expect(isWorkTime(calendar, at('2026-03-06 12:00'), false)).toBe(false)
    const span = { start: at('2026-03-09 09:00'), end: at('2026-03-09 18:00'), dateOnly: false }
    expect(formatTime(startKeepingWork(calendar, span, at('2026-03-10 12:00')))).toBe(
      '2026-03-09 13:00',
    )
  })

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

  it('disables off-time shading and counts 24/7 continuous time when calendar is false', () => {
    const open = resolveCalendar(false)
    expect(open.isWorkday(0)).toBe(true)
    expect(offTime(open, at('2026-03-06 00:00'), at('2026-03-09 23:00'), true)).toEqual([])
    expect(workingMinutes(open, at('2026-03-07 23:59:30'), at('2026-03-08 00:00:15'))).toBeCloseTo(
      0.75,
      10,
    )
    expect(shiftWorkMinutes(open, at('2026-03-07 23:00'), 120)).toBe(at('2026-03-08 01:00'))
    expect(isWorkTime(open, at('2026-03-07 02:30'), false)).toBe(true)
    expect(nextWorkTime(open, at('2026-03-07 02:30'), false)).toBe(at('2026-03-07 02:30'))
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
  it('picks the level by day width, including minute and second scales', () => {
    expect(levelOf(432_000).name).toBe('second')
    expect(levelOf(21_600).name).toBe('minute')
    expect(levelOf(960).name).toBe('hour')
    expect(levelOf(40).name).toBe('day')
    expect(levelOf(16).name).toBe('week')
    expect(levelOf(0.2).name).toBe('year')
    expect(DAY_WIDTH_RANGE[1]).toBeGreaterThanOrEqual(432_000)
  })

  it('picks readable sub-hour header steps and snap steps', () => {
    expect(minuteStep(21_600)).toBe(5)
    expect(minuteStep(96_000)).toBe(1)
    expect(minuteStep(4_000)).toBe(30)
    expect(secondStep(432_000)).toBe(15)
    expect(secondStep(1_440_000)).toBe(5)
    expect(secondStep(8_640_000)).toBe(1)
    expect(headerStepFor('minute', 21_600)).toBe(5)
    expect(headerStepFor('second', 432_000)).toBe(15)
    expect(snapStep(21_600)).toBe(5)
    expect(snapStep(432_000)).toBeCloseTo(10 / 60, 10)
  })

  it('finds unit starts, including minute and second steps', () => {
    // a Wednesday
    const wed = at('2026-10-14 15:23:47')
    expect(unitStart('second', wed, 1, 15)).toBeCloseTo(at('2026-10-14 15:23:45'), 10)
    expect(unitStart('minute', wed, 1, 5)).toBe(at('2026-10-14 15:20'))
    expect(unitStart('week', wed, 1)).toBe(at('2026-10-12'))
    expect(unitStart('week', wed, 0)).toBe(at('2026-10-11'))
    expect(unitStart('quarter', wed)).toBe(at('2026-10-01'))
    expect(unitStart('hour', wed, 1, 6)).toBe(at('2026-10-14 12:00'))
    expect(unitsBetween('month', at('2026-11-15'), at('2027-01-02')).length).toBe(3)
    expect(
      unitsBetween('minute', at('2026-10-14 15:00'), at('2026-10-14 15:15'), 1, 5).length,
    ).toBe(3)
    expect(
      unitsBetween('second', at('2026-10-14 15:00:00'), at('2026-10-14 15:01:00'), 1, 15).length,
    ).toBe(4)
  })

  it('formats sub-hour labels and durations cleanly', () => {
    const zh = ganttLocales['zh-CN']!
    const en = ganttLocales.en!
    const moment = at('2026-10-14 15:05:30')
    expect(unitLabel('hour', at('2026-10-14 15:00'), zh, 21_600)).toBe('10月14日 15:00')
    expect(unitLabel('minute', at('2026-10-14 15:05'), zh, 21_600)).toBe('15:05')
    expect(unitLabel('minute', at('2026-10-14 15:05'), zh, 432_000)).toBe('10月14日 15:05')
    expect(unitLabel('second', moment, zh, 432_000)).toBe('15:05:30')
    expect(dateLabel(moment, false, zh)).toBe('10月14日 15:05:30')
    expect(timedDurationLabel(0.5, zh)).toBe('30 秒')
    expect(timedDurationLabel(12, zh)).toBe('12 分钟')
    expect(timedDurationLabel(90, en)).toBe('1.5 h')
    expect(
      durationLabel(
        { start: at('2026-10-14 15:00:00'), end: at('2026-10-14 15:00:18'), dateOnly: false },
        resolveCalendar(false),
        zh,
      ),
    ).toBe('18 秒')
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

  it('reads lags in days, hours, minutes and seconds', () => {
    expect(parseLag(2)).toEqual({ amount: 2, unit: 'day' })
    expect(parseLag('2d')).toEqual({ amount: 2, unit: 'day' })
    expect(parseLag('4h')).toEqual({ amount: 240, unit: 'minute' })
    expect(parseLag('-30m')).toEqual({ amount: -30, unit: 'minute' })
    expect(parseLag('30s')).toEqual({ amount: 0.5, unit: 'minute' })
    expect(parseLag(undefined)).toEqual({ amount: 0, unit: 'day' })
    expect(parseLag('soon')).toBeNull()
  })
})
