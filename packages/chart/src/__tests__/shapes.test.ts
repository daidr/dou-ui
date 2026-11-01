import { describe, expect, it } from 'vitest'
import { barKind } from '../core/bar'
import { arcBox, layoutChart, layoutPie, type AxisConfig } from '../core/layout'
import { buildModel, type SeriesInput } from '../core/model'
import { pieSlices, sliceOuter } from '../core/pie'

const input = (index: number, props: Record<string, unknown>): SeriesInput => ({
  index,
  kind: barKind,
  props: props as never,
})
const measure = (text: string) => text.length * 7
const axis = (position: AxisConfig['position'], extra: Partial<AxisConfig> = {}): AxisConfig => ({
  position,
  grid: false,
  hidden: false,
  ...extra,
})

const rows = [
  { k: '徐汇', a: 3, b: 1 },
  { k: '静安', a: 1, b: 1 },
  { k: '浦东', a: 5, b: 2 },
]

describe('category sort', () => {
  it('orders categories by the total of the series shown', () => {
    const series = [input(0, { y: 'a' }), input(1, { y: 'b' })]
    const down = buildModel(series, { data: rows, x: 'k', sort: 'desc' })
    expect(down.categories).toEqual(['浦东', '徐汇', '静安'])
    // each row moves with its category
    expect([...down.series[0]!.x.values]).toEqual([1, 2, 0])
    const up = buildModel(series, { data: rows, x: 'k', sort: 'asc' })
    expect(up.categories).toEqual(['静安', '徐汇', '浦东'])
    // a hidden series does not count
    const only = buildModel([input(0, { y: 'a', hidden: true }), input(1, { y: 'b' })], {
      data: rows,
      x: 'k',
      sort: 'desc',
    })
    expect(only.categories[0]).toBe('浦东')
  })

  it('orders by a comparison of the names', () => {
    const model = buildModel([input(0, { y: 'a' })], {
      data: rows,
      x: 'k',
      sort: (p, q) => q.localeCompare(p),
    })
    const names = ['静安', '浦东', '徐汇']
    names.sort((p, q) => q.localeCompare(p))
    expect(model.categories).toEqual(names)
  })
})

describe('reversed axis', () => {
  it('runs the value axis the other way', () => {
    const model = buildModel([input(0, { y: 'a' })], { data: rows, x: 'k' })
    const lay = (reverse: boolean) =>
      layoutChart({
        model,
        axes: { x: axis('bottom'), y: axis('left', { reverse }), y2: null },
        width: 400,
        height: 200,
        locale: 'zh-CN',
        measure,
      })
    const up = lay(false).y.y!.scale
    const down = lay(true).y.y!.scale
    expect(up.map(0)).toBeGreaterThan(up.map(5))
    expect(down.map(0)).toBeLessThan(down.map(5))
  })

  it('runs categories the other way', () => {
    const model = buildModel([input(0, { y: 'a' })], { data: rows, x: 'k' })
    const layout = layoutChart({
      model,
      axes: { x: axis('bottom', { reverse: true }), y: axis('left'), y2: null },
      width: 400,
      height: 200,
      locale: 'zh-CN',
      measure,
    })
    expect(layout.x.scale.map(0)).toBeGreaterThan(layout.x.scale.map(2))
  })
})

describe('pie shapes', () => {
  it('measures the box an arc takes, with its center', () => {
    const half = arcBox(-Math.PI / 2, Math.PI / 2)
    expect(half.left).toBeCloseTo(-1)
    expect(half.right).toBeCloseTo(1)
    expect(half.top).toBeCloseTo(-1)
    expect(half.bottom).toBeCloseTo(0)
    const whole = arcBox(0, Math.PI * 2)
    expect([whole.left, whole.top, whole.right, whole.bottom]).toEqual([-1, -1, 1, 1])
  })

  it('lays a half donut out larger than a whole one', () => {
    const base = { width: 400, height: 200, measure }
    const whole = layoutPie(base)
    const half = layoutPie({ ...base, arc: [-Math.PI / 2, Math.PI / 2] })
    expect(half.radius).toBeGreaterThan(whole.radius)
    // its flat edge sits at the bottom of the room
    expect(half.cy).toBeGreaterThan(whole.cy)
  })

  it('shares out only the arc it is given', () => {
    const data = [{ v: 1 }, { v: 1 }]
    const slices = pieSlices(data, 'v', undefined, undefined, [], {
      start: -Math.PI / 2,
      end: Math.PI / 2,
    })
    expect(slices[0]!.start).toBeCloseTo(-Math.PI / 2)
    expect(slices[0]!.end).toBeCloseTo(0)
    expect(slices[1]!.end).toBeCloseTo(Math.PI / 2)
  })

  it('gives a rose equal angles and areas by value', () => {
    const data = [{ v: 4 }, { v: 1 }]
    const [big, small] = pieSlices(data, 'v', undefined, undefined, [], { rose: true })
    expect(big!.end - big!.start).toBeCloseTo(small!.end - small!.start)
    expect(sliceOuter(big!, 20, 100)).toBe(100)
    // the ring the small one fills is a quarter of the big one's
    const r = sliceOuter(small!, 20, 100)
    expect(r * r - 20 * 20).toBeCloseTo((100 * 100 - 20 * 20) / 4)
  })
})
