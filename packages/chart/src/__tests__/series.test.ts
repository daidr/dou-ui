import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { h, nextTick } from 'vue'
import { DouChart, DouChartBar, DouChartLine, DouChartPie, defineChartSeries } from '..'
import { barKind, barPlacement, drawBars } from '../core/bar'
import { layoutChart, type AxisConfig } from '../core/layout'
import { buildModel, type SeriesInput } from '../core/model'
import type { Painter } from '../core/painter'
import { pieSlices } from '../core/pie'
import { categoryScale, linearScale } from '../core/scale'
import { drawScatter, scatterKind } from '../core/scatter'
import type { ChartSeries, ChartView } from '../core/series'

/** A painter that records what is drawn. */
function recorder() {
  const calls: Array<[string, unknown[]]> = []
  const painter = new Proxy({} as Record<string, unknown>, {
    get: (target, key: string) =>
      key in target ? target[key] : (...args: unknown[]) => calls.push([key, args]),
    set: (target, key: string, value) => {
      target[key] = value
      return true
    },
  }) as unknown as Painter
  const count = (name: string) => calls.filter(([key]) => key === name).length
  return { painter, calls, count }
}

const input = (index: number, props: Record<string, unknown>, kind = barKind): SeriesInput => ({
  index,
  kind,
  props: props as never,
})

const resolve = (model: ReturnType<typeof buildModel>): ChartSeries[] =>
  model.series.map((s) => ({
    ...s,
    index: s.input.index,
    kind: s.input.kind,
    props: s.input.props,
    color: '#000',
  }))

const colors = { surface: '#fff', grid: '#eee', baseline: '#ccc' }

describe('bars', () => {
  it('splits each band among series, a stack sharing one part', () => {
    const rows = [{ k: 'a', p: 1, q: 2, r: 3 }]
    const model = buildModel(
      [input(0, { y: 'p', stack: 's' }), input(1, { y: 'q', stack: 's' }), input(2, { y: 'r' })],
      { data: rows, x: 'k' },
    )
    expect(model.series.map((s) => s.slot)).toEqual([
      { index: 0, count: 2 },
      { index: 0, count: 2 },
      { index: 1, count: 2 },
    ])
    const one = barPlacement(100, { index: 0, count: 2 })
    const two = barPlacement(100, { index: 1, count: 2 })
    expect(one.width).toBe(two.width)
    expect(two.offset).toBeCloseTo(one.offset + one.width + 2)
    // the group is centered on the band
    expect(one.offset + two.offset + two.width).toBeCloseTo(0)
    expect(barPlacement(1000, null).width).toBe(56)
  })

  it('leaves half a band at both ends of a number axis', () => {
    const rows = [0, 2, 3, 7].map((x) => ({ x, v: x }))
    const model = buildModel([input(0, { y: 'v' })], { data: rows, x: 'x' })
    expect(model.xStep).toBe(1)
    expect(model.x).toEqual([0, 7])
    const layout = layoutChart({
      model,
      axes: { x: axis('bottom'), left: axis('left'), right: null },
      width: 400,
      height: 200,
      locale: 'zh-CN',
      measure,
    })
    expect(layout.x.scale.domain).toEqual([-0.5, 7.5])
  })

  it('rounds only the outermost bar of a stack, and leaves a hairline between slices', () => {
    const rows = [{ k: 'a', p: 10, q: 20 }]
    const model = buildModel(
      [input(0, { y: 'p', stack: true }), input(1, { y: 'q', stack: true })],
      {
        data: rows,
        x: 'k',
      },
    )
    const [p, q] = resolve(model)
    const view: ChartView = {
      x: categoryScale(['a'], [0, 100]),
      y: linearScale([0, 30], [300, 0]),
      horizontal: false,
      band: 100,
      plot: { x: 0, y: 0, width: 100, height: 300 },
      dpr: 1,
      colors,
    }
    const inner = recorder()
    drawBars(inner.painter, p as never, view)
    expect(inner.count('rect')).toBe(1)
    expect(inner.count('arcTo')).toBe(0)
    const outer = recorder()
    drawBars(outer.painter, q as never, view)
    expect(outer.count('arcTo')).toBe(2)
    // 56px wide, centered at 50; starts a pixel above the slice under it (200px)
    expect(outer.calls.find(([key]) => key === 'moveTo')).toEqual(['moveTo', [22, 199]])
  })

  it('merges bars thinner than a pixel and a half by pixel column', () => {
    const rows = Array.from({ length: 10_000 }, (_, i) => ({ x: i, v: i % 7 }))
    const model = buildModel([input(0, { y: 'v' })], { data: rows, x: 'x' })
    const [series] = resolve(model)
    const view: ChartView = {
      x: linearScale([-0.5, 9999.5], [0, 200]),
      y: linearScale([0, 7], [100, 0]),
      horizontal: false,
      band: 0.02,
      plot: { x: 0, y: 0, width: 200, height: 100 },
      dpr: 1,
      colors,
    }
    const { painter, count } = recorder()
    drawBars(painter, series as never, view)
    expect(count('rect')).toBeLessThanOrEqual(201)
    expect(count('fill')).toBe(1)
  })

  it('lays x down the left side when horizontal', () => {
    const rows = [
      { k: '浦东新区', v: 3 },
      { k: '静安区', v: 5 },
    ]
    const model = buildModel([input(0, { y: 'v' })], { data: rows, x: 'k' })
    const layout = layoutChart({
      model,
      horizontal: true,
      axes: { x: axis('left'), left: axis('bottom', { grid: true }), right: null },
      width: 400,
      height: 200,
      locale: 'zh-CN',
      measure,
    })
    const x = layout.x
    expect(x.position).toBe('left')
    // the first category at the top, labels ending a gap before the plot
    expect(x.scale.map(0)).toBeLessThan(x.scale.map(1))
    expect(x.labels.map((l) => l.left + l.width)).toEqual([layout.plot.x - 8, layout.plot.x - 8])
    const values = layout.y.left!
    expect(values.position).toBe('bottom')
    expect(values.scale.map(0)).toBe(layout.plot.x)
    for (const label of values.labels)
      expect(label.top).toBe(layout.plot.y + layout.plot.height + 8)
  })
})

describe('scatter', () => {
  it('draws dots on one pixel once when there are many', () => {
    const rows = Array.from({ length: 5000 }, (_, i) => ({ x: i % 10, y: Math.floor(i / 10) % 5 }))
    const model = buildModel([input(0, { y: 'y' }, scatterKind)], { data: rows, x: 'x' })
    const [series] = resolve(model)
    const view: ChartView = {
      x: linearScale([0, 9], [0, 90]),
      y: linearScale([0, 4], [40, 0]),
      horizontal: false,
      band: 0,
      plot: { x: 0, y: 0, width: 90, height: 40 },
      dpr: 1,
      colors,
    }
    const { painter, count } = recorder()
    drawScatter(painter, series as never, view)
    expect(count('arc')).toBe(50)
  })

  it('widens the axes so the largest bubble fits', () => {
    const rows = [
      { x: 0, y: 0, s: 1 },
      { x: 10, y: 10, s: 4 },
    ]
    const model = buildModel([input(0, { y: 'y', size: 's', radius: 20 }, scatterKind)], {
      data: rows,
      x: 'x',
    })
    expect(model.inset).toBe(21)
    const layout = layoutChart({
      model,
      axes: { x: axis('bottom'), left: axis('left', { nice: false }), right: null },
      width: 400,
      height: 300,
      locale: 'zh-CN',
      measure,
    })
    const { plot } = layout
    expect(layout.x.scale.map(10)).toBeCloseTo(plot.x + plot.width - 21)
    expect(layout.y.left!.scale.map(10)).toBeCloseTo(plot.y + 21)
  })
})

describe('pie', () => {
  it('goes round from the top, leaving out values of 0 or less', () => {
    const slices = pieSlices(
      [
        { k: 'a', v: 1 },
        { k: 'b', v: 0 },
        { k: 'c', v: 3 },
      ],
      'v',
      'k',
    )
    expect(slices.map((s) => [s.label, s.share])).toEqual([
      ['a', 0.25],
      ['c', 0.75],
    ])
    expect(slices[0]!.start).toBe(0)
    expect(slices[1]!.end).toBeCloseTo(Math.PI * 2)
  })

  it('reads out each slice and shows its slot in the hole', async () => {
    const rows = [
      { item: '房租', amount: 3 },
      { item: '餐饮', amount: 1 },
    ]
    const wrapper = mount(DouChart, {
      props: { data: rows, x: 'item' },
      slots: {
        default: () =>
          h(DouChartPie, { value: 'amount', name: '支出', innerRadius: 0.6 }, () => '合计 4'),
      },
      attachTo: document.body,
    })
    const root = wrapper.find('.dou-chart').element as HTMLElement
    root.getBoundingClientRect = () => ({ width: 400, height: 300 }) as DOMRect
    Object.defineProperty(root, 'clientWidth', { value: 400 })
    Object.defineProperty(root, 'clientHeight', { value: 300 })
    await wrapper.setProps({ height: 300 })
    await nextTick()
    expect(root.getAttribute('aria-label')).toBe('图表。支出：房租 3（75%）；餐饮 1（25%）')
    expect(wrapper.find('.dou-chart__center').text()).toBe('合计 4')
    expect(wrapper.findAll('.dou-chart__legend.is-pie').map((item) => item.text())).toEqual([
      '房租',
      '餐饮',
    ])
    wrapper.unmount()
  })
})

describe('defineChartSeries', () => {
  it('makes a series that sits in a chart like the built-in ones', async () => {
    const drawn: string[] = []
    const DouChartTick = defineChartSeries({
      name: 'tick',
      zero: true,
      props: { size: { type: Number, default: 4 } },
      draw: (_painter, series) => drawn.push(`${series.name}:${series.props.size}`),
    })
    expect(DouChartTick.name).toBe('DouChartTick')
    const rows = [
      { m: '一月', a: 10, b: 4 },
      { m: '二月', a: 30, b: 6 },
    ]
    const wrapper = mount(DouChart, {
      props: { data: rows, x: 'm' },
      slots: {
        default: () => [
          h(DouChartBar, { y: 'a', name: '数量' }),
          h(DouChartTick, { y: 'b', name: '目标', size: 6 }),
          h(DouChartLine, { y: 'b', name: '趋势' }),
        ],
      },
    })
    await nextTick()
    expect(wrapper.find('.dou-chart').attributes('aria-label')).toMatch(
      /数量：.*；目标：2 个数据点，最小 4，最大 6；趋势：/,
    )
    wrapper.unmount()
    expect(drawn).toEqual([])
  })
})

/* helpers */

function axis(position: AxisConfig['position'], extra: Partial<AxisConfig> = {}): AxisConfig {
  return { position, grid: false, hidden: false, ...extra }
}

function measure(text: string) {
  return text.length * 7
}
