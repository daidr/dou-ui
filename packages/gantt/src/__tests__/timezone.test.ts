import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, nextTick, ref, shallowRef } from 'vue'
import {
  endKeepingWork,
  resolveCalendar,
  shiftWorkMinutes,
  shiftWorkdays,
  workdaysBetween,
  workingMinutes,
} from '../core/calendar'
import { readCSVDate, readGanttCSV } from '../core/csv'
import { spanOf, writeSpan } from '../core/model'
import { unitStart, unitsBetween, type GanttScale } from '../core/scale'
import { formatTime, instantOf, parseTime, toTimestamp, type GanttTime } from '../core/time'
import { ganttLocales } from '../locale'
import { useTimeAxis } from '../time-axis'

function withTZ<T>(tz: string, fn: () => T): T {
  const prev = process.env.TZ
  process.env.TZ = tz
  try {
    return fn()
  } finally {
    if (prev === undefined) delete process.env.TZ
    else process.env.TZ = prev
  }
}

async function withTZAsync<T>(tz: string, fn: () => Promise<T>): Promise<T> {
  const prev = process.env.TZ
  process.env.TZ = tz
  try {
    return await fn()
  } finally {
    if (prev === undefined) delete process.env.TZ
    else process.env.TZ = prev
  }
}

function dstCalendarSnapshot() {
  const calendar = resolveCalendar()
  const springStart = parseTime('2026-03-08 00:00')!.at
  const springEnd = parseTime('2026-03-09 00:00')!.at
  const fallStart = parseTime('2026-11-01 00:00')!.at
  const fallEnd = parseTime('2026-11-02 00:00')!.at

  return {
    springHours: unitsBetween('hour', springStart, springEnd).length,
    fallHours: unitsBetween('hour', fallStart, fallEnd).length,
    springDays: unitsBetween('day', parseTime('2026-03-06')!.at, parseTime('2026-03-11')!.at)
      .length,
    fallDays: unitsBetween('day', parseTime('2026-10-30')!.at, parseTime('2026-11-04')!.at).length,
    springWorkdays: workdaysBetween(
      calendar,
      parseTime('2026-03-06')!.at,
      parseTime('2026-03-11')!.at,
    ),
    fallWorkdays: workdaysBetween(
      calendar,
      parseTime('2026-10-30')!.at,
      parseTime('2026-11-04')!.at,
    ),
    springShift: formatTime(shiftWorkdays(calendar, parseTime('2026-03-06')!.at, 3), true),
    fallShift: formatTime(shiftWorkdays(calendar, parseTime('2026-10-30')!.at, 3), true),
    springMinutes: workingMinutes(
      calendar,
      parseTime('2026-03-06 16:00')!.at,
      parseTime('2026-03-09 11:00')!.at,
    ),
    springShiftedMin: formatTime(
      shiftWorkMinutes(calendar, parseTime('2026-03-06 16:00')!.at, 240),
    ),
    keptEnd: formatTime(
      endKeepingWork(
        calendar,
        {
          start: parseTime('2026-03-06')!.at,
          end: parseTime('2026-03-10')!.at,
          dateOnly: true,
        },
        parseTime('2026-10-30')!.at,
      ),
    ),
  }
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('timezone and DST boundaries', () => {
  it('keeps naive wall-clock strings identical across timezones and does not cache offset strings globally', () => {
    const naive = '2026-03-08 02:30'
    const isoUtc = '2026-03-08T12:00:00Z'
    const isoOffset = '2026-03-08T12:00:00+05:30'

    const zones = [
      { tz: 'UTC', utcWall: '2026-03-08 12:00', offsetWall: '2026-03-08 06:30' },
      { tz: 'Asia/Shanghai', utcWall: '2026-03-08 20:00', offsetWall: '2026-03-08 14:30' },
      // 2026-03-08 12:00Z is already EDT (-04:00) in New York; 06:30Z is still EST (-05:00)
      { tz: 'America/New_York', utcWall: '2026-03-08 08:00', offsetWall: '2026-03-08 01:30' },
      // Europe/Berlin switches on 2026-03-29, so 2026-03-08 is CET (+01:00)
      { tz: 'Europe/Berlin', utcWall: '2026-03-08 13:00', offsetWall: '2026-03-08 07:30' },
      { tz: 'Asia/Kolkata', utcWall: '2026-03-08 17:30', offsetWall: '2026-03-08 12:00' },
      // Australia/Lord_Howe is LHDT (+11:00) in March
      { tz: 'Australia/Lord_Howe', utcWall: '2026-03-08 23:00', offsetWall: '2026-03-08 17:30' },
    ]

    const naiveValues = new Set<number>()
    for (const { tz, utcWall, offsetWall } of zones) {
      withTZ(tz, () => {
        naiveValues.add(parseTime(naive)!.at)
        expect(formatTime(parseTime(isoUtc)!.at)).toBe(utcWall)
        expect(formatTime(parseTime(isoOffset)!.at)).toBe(offsetWall)
        expect(readCSVDate(isoUtc)).toBe(utcWall)
      })
    }
    expect(naiveValues.size).toBe(1)
  })

  it('keeps toTimestamp monotonic across spring-forward DST gaps and preserves positive numeric spans', () => {
    // America/New_York: 2026-03-08 02:00 -> 03:00 (23-hour day)
    withTZ('America/New_York', () => {
      const t0159 = toTimestamp(parseTime('2026-03-08 01:59:59')!.at)
      const t0200 = toTimestamp(parseTime('2026-03-08 02:00:00')!.at)
      const t0230 = toTimestamp(parseTime('2026-03-08 02:30:00')!.at)
      const t0259 = toTimestamp(parseTime('2026-03-08 02:59:59')!.at)
      const t0300 = toTimestamp(parseTime('2026-03-08 03:00:00')!.at)
      const t0301 = toTimestamp(parseTime('2026-03-08 03:00:01')!.at)

      expect(t0159).toBe(Date.UTC(2026, 2, 8, 6, 59, 59))
      expect(t0200).toBe(Date.UTC(2026, 2, 8, 7, 0, 0))
      expect(t0230).toBe(t0300)
      expect(t0259).toBe(t0300)
      expect(t0300).toBe(Date.UTC(2026, 2, 8, 7, 0, 0))
      expect(t0301).toBe(Date.UTC(2026, 2, 8, 7, 0, 1))
      expect(t0159).toBeLessThan(t0200)
      expect(t0230).toBeLessThanOrEqual(t0300)
      expect(t0300).toBeLessThan(t0301)

      // dragging a numeric task into the missing hour must not collapse end <= start
      const numericTask = {
        id: 'n',
        title: 'N',
        start: Date.UTC(2026, 2, 8, 6, 0, 0),
        end: Date.UTC(2026, 2, 8, 6, 30, 0),
      }
      const moved = writeSpan(
        numericTask,
        parseTime('2026-03-08 02:10:00')!.at,
        parseTime('2026-03-08 02:40:00')!.at,
      )
      expect(typeof moved.start).toBe('number')
      expect(typeof moved.end).toBe('number')
      expect((moved.end as number) - (moved.start as number)).toBe(30 * 60_000)
    })

    // Europe/Berlin: 2026-03-29 02:00 -> 03:00
    withTZ('Europe/Berlin', () => {
      const gap = toTimestamp(parseTime('2026-03-29 02:30:00')!.at)
      const after = toTimestamp(parseTime('2026-03-29 03:00:00')!.at)
      expect(gap).toBe(after)
      expect(after).toBe(Date.UTC(2026, 2, 29, 1, 0, 0))
    })

    // Australia/Lord_Howe: 30-minute spring-forward 2026-10-04 02:00 -> 02:30
    withTZ('Australia/Lord_Howe', () => {
      const gap = toTimestamp(parseTime('2026-10-04 02:15:00')!.at)
      const after = toTimestamp(parseTime('2026-10-04 02:30:00')!.at)
      expect(gap).toBe(after)
      expect(after).toBe(Date.UTC(2026, 9, 3, 15, 30, 0))
    })

    // America/Havana: midnight spring-forward 2026-03-08 00:00 -> 01:00
    withTZ('America/Havana', () => {
      const midnight = toTimestamp(parseTime('2026-03-08 00:00:00')!.at)
      const oneAm = toTimestamp(parseTime('2026-03-08 01:00:00')!.at)
      expect(midnight).toBe(oneAm)
      expect(oneAm).toBe(Date.UTC(2026, 2, 8, 5, 0, 0))
    })
  })

  it('preserves positive durations across fall-back DST repeated hours in spans, CSV, range and fit', async () => {
    // America/New_York: 2026-11-01 01:00–02:00 occurs twice (EDT -04:00 then EST -05:00)
    await withTZAsync('America/New_York', async () => {
      const startIso = '2026-11-01T01:45:00-04:00' // 05:45Z
      const endIso = '2026-11-01T01:15:00-05:00' // 06:15Z (30 minutes later!)
      const startMs = Date.UTC(2026, 10, 1, 5, 45, 0)
      const endMs = Date.UTC(2026, 10, 1, 6, 15, 0)
      expect(instantOf(startIso)).toBe(startMs)
      expect(instantOf(endIso)).toBe(endMs)

      // spanOf keeps real 30m duration for both ISO-offset strings and numeric Unix timestamps
      const isoSpan = spanOf({ id: 'iso', title: 'ISO', start: startIso, end: endIso })!
      expect(isoSpan.end - isoSpan.start).toBeCloseTo(30, 6)
      const numSpan = spanOf({ id: 'num', title: 'NUM', start: startMs, end: endMs })!
      expect(numSpan.end - numSpan.start).toBeCloseTo(30, 6)

      // CSV import keeps the 30m span without warning
      const csv = readGanttCSV(`任务,开始,结束\n回拨,${startIso},${endIso}`, {
        columns: [{ key: 'title' }, { key: 'start' }, { key: 'end' }],
        messages: ganttLocales['zh-CN']!,
        calendar: resolveCalendar(false),
      })
      expect(csv.warnings).toEqual([])
      expect(csv.tasks[0]).toMatchObject({
        start: '2026-11-01 01:45',
        end: '2026-11-01 02:15',
      })

      // time-axis fixed range and live fit([now - 30m, now]) during the repeated hour
      vi.useFakeTimers()
      vi.setSystemTime(endMs)
      vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query }))
      let axis!: ReturnType<typeof useTimeAxis>
      const el = document.createElement('div')
      let left = 0
      Object.defineProperties(el, {
        clientWidth: { get: () => 800 },
        scrollWidth: { get: () => Math.max(axis?.totalWidth.value ?? 0, 800) },
        scrollLeft: {
          get: () => left,
          set: (v: number) => {
            left = Math.max(0, v)
          },
        },
      })
      document.body.append(el)
      const range = ref<[GanttTime, GanttTime] | undefined>([startMs, endMs])
      const follow = ref(true)
      const scaleRef = ref<GanttScale | undefined>('hour')
      const wrapper = mount(
        defineComponent({
          setup() {
            axis = useTimeAxis({
              chart: shallowRef(el),
              tableBody: shallowRef(null),
              viewWidth: ref(800),
              scale: scaleRef,
              follow,
              range: () => range.value,
              today: () => true,
              weekStart: computed(() => 1),
              calendar: computed(() => resolveCalendar(false)),
              messages: computed(() => ganttLocales['zh-CN']!),
              content: computed(() => ({ start: isoSpan.start, end: isoSpan.end, timed: true })),
              fitWidth: () => 800,
            })
            return () => null
          },
        }),
        { attachTo: document.body },
      )
      await nextTick()

      // fixed range respects the 30-minute span instead of falling back to unfixed extent
      expect(axis.extent.value.end - axis.extent.value.start).toBeCloseTo(30, 6)

      // live fit([now - 30m, now]) switches to minute scale and keeps follow enabled
      range.value = undefined
      await nextTick()
      axis.fit([startMs, endMs])
      await nextTick()
      expect(follow.value).toBe(true)
      expect(scaleRef.value).toBe('minute')
      expect(axis.todayX.value! - axis.scrollLeft.value).toBeCloseTo(720, 0)
      wrapper.unmount()
    })

    // Europe/Berlin: 2026-10-25 02:00–03:00 repeated (CEST +02:00 -> CET +01:00)
    withTZ('Europe/Berlin', () => {
      const span = spanOf({
        id: 'eu',
        title: 'EU',
        start: '2026-10-25T02:45:00+02:00',
        end: '2026-10-25T02:15:00+01:00',
      })!
      expect(span.end - span.start).toBeCloseTo(30, 6)
    })
  })

  it('keeps scale ticks and work calendar arithmetic identical across DST transitions in every timezone', () => {
    const expected = withTZ('UTC', dstCalendarSnapshot)
    expect(expected).toEqual({
      springHours: 24,
      fallHours: 24,
      springDays: 5,
      fallDays: 5,
      springWorkdays: 3,
      fallWorkdays: 3,
      springShift: '2026-03-11',
      fallShift: '2026-11-04',
      springMinutes: 240,
      springShiftedMin: '2026-03-09 11:00',
      keptEnd: '2026-11-03 00:00',
    })

    for (const tz of ['America/New_York', 'Europe/Berlin', 'Asia/Shanghai', 'Asia/Kolkata']) {
      expect(withTZ(tz, dstCalendarSnapshot)).toEqual(expected)
    }
  })

  it('handles years 0000-0099 and negative pre-1970 hour alignment cleanly', () => {
    const early = parseTime('0050-06-15 10:30')!
    expect(formatTime(early.at)).toBe('0050-06-15 10:30')
    expect(formatTime(early.at, true)).toBe('0050-06-15')

    const preEpoch = parseTime('1969-12-31 23:30')!.at
    expect(formatTime(unitStart('hour', preEpoch, 1, 6))).toBe('1969-12-31 18:00')
    expect(formatTime(unitStart('hour', parseTime('1969-12-31 17:45')!.at, 1, 6))).toBe(
      '1969-12-31 12:00',
    )
  })
})
