import { describe, expect, it } from 'vitest'
import { carriesOn, inferXKind, rowCount, rowOf, toTime, xColumn, yColumn } from '../core/data'
import { sortedOrder } from '../core/hit'
import { BREAK, decimate, summarize, visibleRange } from '../core/decimate'
import { numberTickFormat, timeFormatFull, timePrecision, timeTickFormat } from '../core/format'
import { areaKind, lineKind } from '../core/line'
import { buildModel } from '../core/model'
import { monotoneTangents } from '../core/painter'
import {
  categoryScale,
  linearDomain,
  linearScale,
  linearTicks,
  logDomain,
  logTicks,
  nextNiceStep,
  niceStep,
} from '../core/scale'
import { timeInterval, timeTicks } from '../core/time'

const day = (y: number, m: number, d: number, h = 0) => new Date(y, m - 1, d, h).getTime()

describe('data', () => {
  it('reads dates without a zone in local time', () => {
    expect(toTime('2026-10-31')).toBe(day(2026, 10, 31))
    expect(toTime('2026-10-31 09:30')).toBe(new Date(2026, 9, 31, 9, 30).getTime())
    expect(toTime(new Date(5))).toBe(5)
  })

  it('guesses the kind of x from the first value there', () => {
    expect(inferXKind([{ x: null }, { x: 3 }], 'x')).toBe('linear')
    expect(inferXKind([{ x: '2026-01-02' }], 'x')).toBe('time')
    expect(inferXKind([{ x: new Date() }], 'x')).toBe('time')
    expect(inferXKind([{ x: '一月' }], 'x')).toBe('category')
  })

  it('reads columns once per array and accessor', () => {
    const rows = [
      { x: 'a', y: 1 },
      { x: 'b', y: null },
      { x: 'a', y: '3' },
    ]
    const x = xColumn(rows, 'x', 'category')
    expect([...x.values]).toEqual([0, 1, 0])
    expect(x.categories).toEqual(['a', 'b'])
    expect(x.sorted).toBe(false)
    expect(xColumn(rows, 'x', 'category')).toBe(x)
    const y = yColumn(rows, 'y')
    expect([...y]).toEqual([1, Number.NaN, 3])
    expect(yColumn(rows, 'y')).toBe(y)
    expect(yColumn([...rows], 'y')).not.toBe(y)
  })
})

const row = (t: number) => ({ t, v: t % 7 === 0 ? null : Math.sin(t) })
const fresh = (rows: object[]) => rows.map((r) => ({ ...r }))
const picked = (r: { indices: Int32Array; length: number }) => [...r.indices.subarray(0, r.length)]

const full = (value: number, gap?: number) => {
  const { unit, digits } = timePrecision(value, gap)
  return timeFormatFull('zh-CN', unit, digits)(value)
}

describe('time in full', () => {
  it('is as precise as the time and its nearest neighbor need', () => {
    const sixth = new Date(2026, 9, 6).getTime()
    expect(full(sixth, 86400e3)).toBe('2026年10月6日')
    expect(full(sixth + 9.5 * 3600e3, 86400e3)).toBe('2026年10月6日 09:30')
    // a second apart: seconds, even on a whole minute
    expect(full(sixth + 12 * 3600e3, 1000)).toBe('2026年10月6日 12:00:00')
    // a tenth of a second apart: tenths, even on a whole second
    expect(full(sixth + 12 * 3600e3, 100)).toBe('2026年10月6日 12:00:00.0')
    expect(full(sixth + 12 * 3600e3 + 250, 100)).toBe('2026年10月6日 12:00:00.25')
  })
})

describe('data by column', () => {
  it('reads columns as they are, typed or not, and puts rows together when asked', () => {
    const data = {
      t: new Float64Array([1, 2, 3, 4]),
      v: [5, null, Number.POSITIVE_INFINITY, '7'],
      w: new Float32Array([1, Number.NaN, 3, Number.NEGATIVE_INFINITY]),
      name: ['甲', '乙', '丙', '丁'],
    }
    expect(rowCount(data)).toBe(4)
    expect(inferXKind(data, 't')).toBe('linear')
    expect(inferXKind(data, 'name')).toBe('category')
    const x = xColumn(data, 't', 'linear')
    expect([...x.values]).toEqual([1, 2, 3, 4])
    expect(x.sorted).toBe(true)
    expect([...yColumn(data, 'v')]).toEqual([5, Number.NaN, Number.NaN, 7])
    expect([...yColumn(data, 'w')]).toEqual([1, Number.NaN, 3, Number.NaN])
    expect([...xColumn(data, 'name', 'category').values]).toEqual([0, 1, 2, 3])
    // a function gets the row put together from every column
    expect([...yColumn(data, (r) => r.t * 10)]).toEqual([10, 20, 30, 40])
    expect(rowOf(data, 1)).toEqual({ t: 2, v: null, w: Number.NaN, name: '乙' })
    expect(rowOf(data, 1)).toBe(rowOf(data, 1))
  })
})

describe('live data', () => {
  it('knows an array that carries on from the last one', () => {
    const a = [1, 2, 3, 4].map(row)
    expect(carriesOn([...a.slice(1), row(5)], a)).toEqual({ dropped: 1, kept: 3 })
    expect(carriesOn([...a, row(5), row(6)], a)).toEqual({ dropped: 0, kept: 4 })
    // the same rows and nothing new: perhaps changed in place
    expect(carriesOn([...a], a)).toBeNull()
    expect(carriesOn([a[0], a[1], row(9), a[3], row(5)], a)).toBeNull()
    expect(carriesOn(fresh(a), a)).toBeNull()
  })

  it('reads only the new rows, and gets the same columns as reading them all', () => {
    let rows = Array.from({ length: 50 }, (_, i) => row(i))
    xColumn(rows, 't', 'time')
    yColumn(rows, 'v')
    for (let step = 1; step <= 30; step++) {
      const added = Array.from({ length: (step % 3) + 1 }, (_, i) => row(1000 + step * 10 + i))
      rows = [...rows.slice(step % 4), ...added]
      const x = xColumn(rows, 't', 'time')
      const y = yColumn(rows, 'v')
      // a copy of each row: not linked to any array before
      const copy = fresh(rows)
      const whole = xColumn(copy, 't', 'time')
      expect([...x.values]).toEqual([...whole.values])
      expect(x.sorted).toBe(true)
      expect([...y]).toEqual([...yColumn(copy, 'v')])
      expect([...sortedOrder(x.values)]).toEqual([...sortedOrder(whole.values)])
    }
  })

  it('reads everything again when a new row is out of order', () => {
    const rows = [1, 2, 3].map(row)
    xColumn(rows, 't', 'linear')
    const next = [...rows, row(0)]
    const x = xColumn(next, 't', 'linear')
    expect([...x.values]).toEqual([1, 2, 3, 0])
    expect(x.sorted).toBe(false)
  })
})

describe('scales', () => {
  it('picks the nice step closest to the wanted count', () => {
    expect(niceStep(86, 5)).toBe(20)
    expect(niceStep(530, 5)).toBe(100)
    expect(niceStep(0.07, 7)).toBe(0.01)
    expect(nextNiceStep(20)).toBe(50)
    expect(nextNiceStep(50)).toBe(100)
  })

  it('rounds a domain out to ticks, without float noise', () => {
    expect(linearDomain(15, 101, { count: 5 })).toEqual([0, 120])
    expect(linearDomain(0.1, 0.7, { count: 6 })).toEqual([0.1, 0.7])
    // the ends stay close to the data: not a coarser step for a wider span
    expect(linearDomain(-2, 105, { count: 4 })).toEqual([-20, 120])
    const [lo, hi] = linearDomain(5, 5)
    expect(lo < 5 && hi > 5).toBe(true)
    expect(linearDomain(0, 0)).toEqual([0, 1])
    expect(linearTicks(0, 0.3, 3)).toEqual([0, 0.1, 0.2, 0.3])
  })

  it('maps and inverts', () => {
    const s = linearScale([0, 10], [100, 0])
    expect(s.map(5)).toBe(50)
    expect(s.invert(25)).toBe(7.5)
    expect(s.map(3)).toBe(3 * s.k + s.b)
  })

  it('puts categories in the middle of their steps', () => {
    const s = categoryScale(['a', 'b', 'c', 'd'], [0, 400])
    expect(s.step).toBe(100)
    expect(s.map(0)).toBe(50)
    expect(s.map(3)).toBe(350)
  })

  it('ticks log axes at powers of ten', () => {
    expect(logDomain(3, 4200)).toEqual([1, 10000])
    expect(logTicks(1, 10000, 5)).toEqual([1, 10, 100, 1000, 10000])
    expect(logTicks(1, 100, 6)).toEqual([1, 2, 5, 10, 20, 50, 100])
  })
})

describe('time ticks', () => {
  it('steps by the smallest round interval that fits', () => {
    expect(timeInterval(day(2026, 11, 1) - day(2026, 9, 7), 12)).toEqual({ unit: 'week', every: 1 })
    expect(timeInterval(24 * 3600e3, 8)).toEqual({ unit: 'hour', every: 3 })
    expect(timeInterval(20 * 365 * 24 * 3600e3, 5)).toEqual({ unit: 'year', every: 5 })
  })

  it('lands on round local times', () => {
    const ticks = timeTicks(day(2026, 9, 7, 5), day(2026, 9, 20), { unit: 'week', every: 1 })
    // Mondays
    expect(ticks).toEqual([day(2026, 9, 14)])
    const months = timeTicks(day(2026, 1, 15), day(2026, 12, 31), { unit: 'month', every: 3 })
    expect(months.map((t) => new Date(t).getMonth())).toEqual([3, 6, 9])
  })

  it('labels the first tick and each new month in full', () => {
    const interval = { unit: 'week' as const, every: 1 }
    const ticks = timeTicks(day(2026, 9, 7), day(2026, 10, 20), interval)
    const format = timeTickFormat('zh-CN', interval)
    expect(ticks.map((t, i) => format(t, ticks[i - 1]))).toEqual([
      '9月7日',
      '14日',
      '21日',
      '28日',
      '10月5日',
      '12日',
      '19日',
    ])
  })

  it('marks a new year on a month axis by the year', () => {
    const interval = { unit: 'month' as const, every: 3 }
    const ticks = timeTicks(day(2026, 1, 1), day(2027, 4, 1), interval)
    const format = timeTickFormat('zh-CN', interval)
    expect(ticks.map((t, i) => format(t, ticks[i - 1]))).toEqual([
      '2026年1月',
      '4月',
      '7月',
      '10月',
      '2027年',
      '4月',
    ])
  })
})

describe('number labels', () => {
  it('shows as many decimals as the step needs', () => {
    const format = numberTickFormat('en', [0, 0.25, 0.5])
    expect(format(0.25)).toBe('0.25')
    expect(numberTickFormat('en', [0, 1000, 2000])(1000)).toBe('1,000')
  })

  it('gives short numbers enough digits to tell ticks apart', () => {
    const ticks = [1.7769e12, 1.777e12, 1.7771e12]
    const texts = ticks.map(numberTickFormat('zh-CN', ticks))
    expect(new Set(texts).size).toBe(3)
  })

  it('shortens long numbers', () => {
    expect(numberTickFormat('zh-CN', [0, 500000, 1000000])(500000)).toBe('50万')
  })
})

describe('decimate', () => {
  const k = 1
  it('keeps the first, lowest, highest and last point of each pixel column', () => {
    const xs = new Float64Array([0, 0.2, 0.4, 0.6, 0.8, 1])
    const ys = new Float64Array([5, 9, 1, 7, 6, 3])
    const { indices, length } = decimate(xs, ys, 0, 6, k, 0)
    expect([...indices.subarray(0, length)]).toEqual([0, 1, 2, 4, 5])
  })

  it('breaks at gaps unless asked to connect', () => {
    const xs = new Float64Array([0, 1, 2, 3])
    const ys = new Float64Array([1, Number.NaN, 2, 3])
    const broken = decimate(xs, ys, 0, 4, k, 0)
    expect([...broken.indices.subarray(0, broken.length)]).toEqual([0, BREAK, 2, 3])
    const joined = decimate(xs, ys, 0, 4, k, 0, true)
    expect([...joined.indices.subarray(0, joined.length)]).toEqual([0, 2, 3])
  })

  it('draws a million points from a few per column', () => {
    const n = 1_000_000
    const xs = new Float64Array(n)
    const ys = new Float64Array(n)
    for (let i = 0; i < n; i++) {
      xs[i] = i
      ys[i] = Math.sin(i / 50)
    }
    const { length } = decimate(xs, ys, 0, n, 1000 / n, 0)
    expect(length).toBeLessThanOrEqual(4 * 1001)
  })

  it('picks the same points when it skips whole blocks of a sorted line', () => {
    const n = 200_000
    const xs = new Float64Array(n)
    const ys = new Float64Array(n)
    let seed = 7
    const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647
    for (let i = 0; i < n; i++) {
      xs[i] = i + random() * 0.5
      // whole numbers, so equal lows and highs come up
      ys[i] = Math.round(Math.sin(i / 300) * 40 + random() * 20)
    }
    for (const gap of [5000, 5001, 70_123, 150_000]) ys[gap] = Number.NaN
    xs[99_999] = Number.NaN
    expect(summarize(xs, ys)).not.toBeNull()
    for (const [from, to, width] of [
      [0, n, 997],
      [0, n, 40],
      [1234, 187_777, 640],
      [30_000, 31_000, 1000],
    ] as const) {
      const scale = width / (to - from)
      const b = -from * scale + 0.37
      for (const connect of [false, true]) {
        const plain = picked(decimate(xs, ys, from, to, scale, b, connect))
        const skipped = picked(decimate(xs, ys, from, to, scale, b, connect, true))
        expect(skipped).toEqual(plain)
      }
    }
  })

  it('finds the visible part of a sorted column, one point wider each side', () => {
    const xs = new Float64Array([0, 1, 2, 3, 4, 5])
    expect(visibleRange(xs, true, 2, 3)).toEqual([1, 5])
    expect(visibleRange(xs, false, 2, 3)).toEqual([0, 6])
  })
})

describe('monotone curve', () => {
  it('stays flat at a peak so the curve does not overshoot it', () => {
    const t = monotoneTangents([0, 1, 2], [0, 10, 0], 3)
    expect(t[1]).toBe(0)
  })
})

const input = (index: number, { hidden, ...props }: Record<string, unknown>, kind = areaKind) => ({
  index,
  kind,
  props: props as never,
  hidden: !!hidden,
})

describe('model', () => {
  const rows = [
    { m: '一月', a: 1, b: 2, c: -1 },
    { m: '二月', a: 3, b: null, c: -2 },
  ]

  it('stacks positives up and negatives down, a gap counting as 0', () => {
    const model = buildModel(
      [
        input(0, { y: 'a', stack: true }),
        input(1, { y: 'b', stack: true }),
        input(2, { y: 'c', stack: true }),
      ],
      { data: rows, x: 'm' },
    )
    expect(model.xKind).toBe('category')
    const [a, b, c] = model.series
    expect([...a!.top]).toEqual([1, 3])
    expect([...b!.base!]).toEqual([1, Number.NaN])
    expect([...b!.top]).toEqual([3, Number.NaN])
    expect([...c!.top]).toEqual([-1, -2])
    expect(model.y.y).toEqual([-2, 3])
    expect(model.zero.y).toBe(true)
  })

  it('merges the categories of series with their own data', () => {
    const model = buildModel(
      [
        input(
          0,
          {
            y: 'v',
            data: [
              { k: 'a', v: 1 },
              { k: 'b', v: 2 },
            ],
            x: 'k',
          },
          lineKind,
        ),
        input(
          1,
          {
            y: 'v',
            data: [
              { k: 'c', v: 1 },
              { k: 'a', v: 2 },
            ],
            x: 'k',
          },
          lineKind,
        ),
      ],
      { data: [] },
    )
    expect(model.categories).toEqual(['a', 'b', 'c'])
    expect([...model.series[1]!.x.values]).toEqual([2, 0])
  })

  it('leaves hidden series out and keeps each on its axis', () => {
    const model = buildModel(
      [input(0, { y: 'a', hidden: true }, lineKind), input(1, { y: 'b', axis: 'y2' }, lineKind)],
      { data: rows, x: 'm' },
    )
    expect(model.series.map((s) => s.name)).toEqual(['b'])
    expect(model.y.y).toBeNull()
    expect(model.y.y2).toEqual([2, 2])
  })
})
