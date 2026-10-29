import { describe, expect, it } from 'vitest'
import {
  VIEW_HEIGHT,
  bars,
  decimate,
  domain,
  extremes,
  linePath,
  normalize,
  runs,
  xOf,
  yOf,
} from '../geometry'

/** The y values a path passes through, from its `M`, `L` and the ends of its `C` commands. */
function pathYs(d: string): number[] {
  const ys: number[] = []
  for (const [, command, args] of d.matchAll(/([MLC])([^MLC]*)/g)) {
    const numbers = args!.trim().split(/\s+/).map(Number)
    const end = command === 'C' ? numbers.slice(4) : numbers
    ys.push(end[1]!)
  }
  return ys
}

/** Every y a cubic curve reaches, sampled finely. */
function curveYs(d: string): number[] {
  const ys: number[] = []
  let y0 = 0
  for (const [, command, args] of d.matchAll(/([MLC])([^MLC]*)/g)) {
    const n = args!.trim().split(/\s+/).map(Number)
    if (command !== 'C') {
      y0 = n[1]!
      ys.push(y0)
      continue
    }
    const [, y1, , y2, , y3] = n as [number, number, number, number, number, number]
    for (let t = 0; t <= 1; t += 0.01) {
      const u = 1 - t
      ys.push(u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3)
    }
    y0 = y3
  }
  return ys
}

describe('sparkline geometry', () => {
  it('reads numbers, objects and gaps, treating NaN and infinities as gaps', () => {
    expect(normalize([1, null, { value: 2, label: '周二' }, Number.NaN, Infinity])).toEqual([
      { value: 1 },
      { value: null },
      { value: 2, label: '周二' },
      { value: null },
      { value: null },
    ])
  })

  it('finds the first, last, lowest and highest values', () => {
    const range = extremes(normalize([null, 3, 1, 5, 1, 5, null]))
    expect(range).toMatchObject({
      first: { index: 1, value: 3 },
      last: { index: 5, value: 5 },
      min: { index: 2, value: 1 },
      max: { index: 3, value: 5 },
      count: 5,
    })
    expect(extremes([]).count).toBe(0)
  })

  it('maps the lowest value to the bottom and the highest to the top', () => {
    const scale = domain(extremes(normalize([10, 20, 30])), { zero: false })
    expect(scale).toEqual({ low: 10, high: 30 })
    expect(yOf(10, scale)).toBe(VIEW_HEIGHT)
    expect(yOf(30, scale)).toBe(0)
    expect(yOf(20, scale)).toBe(VIEW_HEIGHT / 2)
  })

  it('keeps zero in range for bars, and honours a fixed min and max', () => {
    const range = extremes(normalize([10, 20, 30]))
    expect(domain(range, { zero: true })).toEqual({ low: 0, high: 30 })
    expect(domain(extremes(normalize([-5, -1])), { zero: true })).toEqual({ low: -5, high: 0 })
    expect(domain(range, { zero: false, min: 0, max: 100 })).toEqual({ low: 0, high: 100 })
    // swapped bounds are put back in order
    expect(domain(range, { zero: false, min: 100, max: 0 })).toEqual({ low: 0, high: 100 })
    // values beyond a fixed range sit on its edge
    expect(yOf(150, { low: 0, high: 100 })).toBe(0)
    expect(yOf(-1, { low: 0, high: 100 })).toBe(VIEW_HEIGHT)
  })

  it('puts a flat series in the middle', () => {
    const scale = domain(extremes(normalize([7, 7, 7])), { zero: false })
    expect(yOf(7, scale)).toBe(VIEW_HEIGHT / 2)
    expect(yOf(0, domain(extremes(normalize([0, 0])), { zero: false }))).toBe(VIEW_HEIGHT / 2)
    // all-zero bars stay on the baseline
    expect(yOf(0, domain(extremes(normalize([0, 0])), { zero: true }))).toBe(VIEW_HEIGHT)
  })

  it('places a single point in the middle and spreads the rest edge to edge', () => {
    expect(xOf(0, 1)).toBe(500)
    expect(xOf(0, 5)).toBe(0)
    expect(xOf(4, 5)).toBe(1000)
  })

  it('splits the series at gaps', () => {
    const parts = runs(normalize([1, 2, null, 3, null, null, 4, 5]))
    expect(parts.map((run) => run.map((point) => point.index))).toEqual([[0, 1], [3], [6, 7]])
  })

  it('thins long runs but keeps every peak, every dip and both ends', () => {
    const values = Array.from({ length: 10_000 }, (_, i) => Math.sin(i / 50) * 10)
    values[1234] = 99
    values[8765] = -99
    const [run] = runs(normalize(values))
    const thin = decimate(run!, 50)
    expect(thin.length).toBeLessThanOrEqual(2 * Math.ceil(10_000 / 50) + 2)
    expect(thin[0]!.index).toBe(0)
    expect(thin.at(-1)!.index).toBe(9999)
    expect(thin.some((point) => point.index === 1234 && point.value === 99)).toBe(true)
    expect(thin.some((point) => point.index === 8765 && point.value === -99)).toBe(true)
    // still left to right
    for (let i = 1; i < thin.length; i++) expect(thin[i]!.index).toBeGreaterThan(thin[i - 1]!.index)
    // short runs come back as they are
    expect(decimate(run!.slice(0, 10), 1)).toHaveLength(10)
  })

  it('draws straight lines through every point', () => {
    const d = linePath([0, 500, 1000], [100, 0, 50], false)
    expect(d).toBe('M0 100L500 0L1000 50')
  })

  it('smooths without going past any point', () => {
    const xs = [0, 100, 200, 300, 400, 500]
    const ys = [80, 10, 10, 90, 20, 20]
    const d = linePath(xs, ys, true)
    expect(pathYs(d)).toEqual(ys)
    const reached = curveYs(d)
    expect(Math.min(...reached)).toBeGreaterThanOrEqual(10 - 1e-9)
    expect(Math.max(...reached)).toBeLessThanOrEqual(90 + 1e-9)
    // a flat stretch stays flat
    const flat = curveYs(linePath([100, 200], [10, 10], true))
    expect(new Set(flat)).toEqual(new Set([10]))
  })

  it('grows bars from zero, upward for positive and downward for negative values', () => {
    const scale = domain(extremes(normalize([-10, 10])), { zero: true })
    const [down, up] = bars(normalize([-10, 10]), scale, 100)
    expect(up).toMatchObject({ index: 1, y: 0, height: 50 })
    expect(down).toMatchObject({ index: 0, y: 50, height: 50 })
  })

  it('leaves a gap empty and merges crowded bars without hiding the extreme', () => {
    const scale = { low: 0, high: 10 }
    expect(bars(normalize([1, null, 3]), scale, 100).map((bar) => bar.index)).toEqual([0, 2])
    const values = Array.from({ length: 1000 }, () => 1)
    values[517] = 10
    const merged = bars(normalize(values), scale, 50)
    expect(merged).toHaveLength(50)
    expect(merged.some((bar) => bar.index === 517 && bar.height === 100)).toBe(true)
  })
})
