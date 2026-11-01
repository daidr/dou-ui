import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { h, nextTick } from 'vue'
import { DouChart, DouChartBar, DouChartLine, DouChartPie, defineChartSeries } from '..'
import { barKind, barPlacement, drawBars } from '../core/bar'
import { layoutChart, type AxisConfig } from '../core/layout'
import { buildModel, type SeriesInput } from '../core/model'
import type { Painter } from '../core/painter'
import { pieSlices } from '../core/pie'
import { categoryScale, linearScale, logScale } from '../core/scale'
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
      axes: { x: axis('bottom'), y: axis('left'), y2: null },
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
      point: () => [0, 0],
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

  it('leaves out values at or below 0 on a log axis', () => {
    const rows = [
      { k: 'a', v: 10 },
      { k: 'b', v: -5 },
      { k: 'c', v: 0 },
    ]
    const model = buildModel([input(0, { y: 'v' })], { data: rows, x: 'k' })
    const [series] = resolve(model)
    const view: ChartView = {
      x: categoryScale(['a', 'b', 'c'], [0, 300]),
      y: logScale([1, 100], [100, 0]),
      horizontal: false,
      band: 100,
      point: () => [0, 0],
      plot: { x: 0, y: 0, width: 300, height: 100 },
      dpr: 1,
      colors,
    }
    const warn = console.warn
    const seen: string[] = []
    console.warn = (message: string) => seen.push(message)
    const { painter, calls } = recorder()
    drawBars(painter, series as never, view)
    console.warn = warn
    expect(calls.filter(([key]) => key === 'moveTo')).toHaveLength(1)
    expect(seen[0]).toContain('log axis')
  })

  it('draws bars of their own color as one shape per color', () => {
    const rows = ['a', 'b', 'c', 'd'].map((k, i) => ({ k, v: i + 1 }))
    const model = buildModel([input(0, { y: 'v' })], { data: rows, x: 'k' })
    const [series] = resolve(model)
    const view: ChartView = {
      x: categoryScale(['a', 'b', 'c', 'd'], [0, 400]),
      y: linearScale([0, 4], [100, 0]),
      horizontal: false,
      band: 100,
      point: () => [0, 0],
      plot: { x: 0, y: 0, width: 400, height: 100 },
      dpr: 1,
      colors,
    }
    const { painter, calls } = recorder()
    drawBars(painter, { ...series, colors: [undefined, '#f00', undefined, '#f00'] } as never, view)
    // the series' color for a and c, red for b and d: two fills
    const fills = calls.filter(([key]) => key === 'fill')
    expect(fills).toHaveLength(2)
    expect(calls.filter(([key]) => key === 'moveTo' || key === 'rect').length).toBe(4)
    expect((painter as unknown as { fillStyle: string }).fillStyle).toBe('#f00')
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
      point: () => [0, 0],
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
      axes: { x: axis('left'), y: axis('bottom', { grid: true }), y2: null },
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
    const values = layout.y.y!
    expect(values.position).toBe('bottom')
    expect(values.scale.map(0)).toBe(layout.plot.x)
    for (const label of values.labels)
      expect(label.top).toBe(layout.plot.y + layout.plot.height + 8)
  })

  it('keeps value labels apart on a narrow chart, even with more ticks asked', () => {
    const rows = [
      { k: '陆家嘴店', v: 186.4 },
      { k: '五角场店', v: 97.5 },
    ]
    const model = buildModel([input(0, { y: 'v' })], { data: rows, x: 'k' })
    const apart = (ticks: number | undefined, width: number) => {
      const labels = layoutChart({
        model,
        horizontal: true,
        axes: {
          x: axis('left'),
          y: axis('bottom', { ticks, format: (v: unknown) => `${v} 万元` }),
          y2: null,
        },
        width,
        height: 240,
        locale: 'zh-CN',
        measure,
      }).y.y!.labels
      expect(labels.length).toBeGreaterThan(1)
      for (let i = 1; i < labels.length; i++)
        expect(labels[i]!.left).toBeGreaterThanOrEqual(labels[i - 1]!.left + labels[i - 1]!.width)
      return labels.length
    }
    apart(undefined, 320)
    expect(apart(8, 320)).toBeLessThan(8)
    // wide enough: as many as asked, about
    expect(apart(4, 900)).toBeGreaterThanOrEqual(4)
  })

  it('keeps value labels a row apart down short charts, whatever ticks are asked', () => {
    // [height, ticks, the largest value]
    const cases: Array<[number, number | undefined, number]> = [
      [80, 20, 2000],
      [80, undefined, 2000],
      [90, 20, 2000],
      [120, 5, 7],
      [240, 10, 3],
    ]
    for (const [height, ticks, top] of cases) {
      const rows = [
        { k: 'a', v: 0 },
        { k: 'b', v: top },
      ]
      const model = buildModel([input(0, { y: 'v' })], { data: rows, x: 'k' })
      const labels = layoutChart({
        model,
        axes: { x: axis('bottom'), y: axis('left', { ticks }), y2: null },
        width: 400,
        height,
        locale: 'zh-CN',
        measure,
      }).y.y!.labels
      expect(labels.length).toBeGreaterThan(1)
      // a label's height and the gap between rows
      for (let i = 1; i < labels.length; i++)
        expect(Math.abs(labels[i]!.top - labels[i - 1]!.top)).toBeGreaterThanOrEqual(19.5)
    }
  })

  it('lays out quickly however many ticks are asked across a narrow chart', () => {
    const model = buildModel([input(0, { y: 'v' })], {
      data: [
        { k: 'a', v: 0 },
        { k: 'b', v: 186 },
      ],
      x: 'k',
    })
    const start = performance.now()
    layoutChart({
      model,
      horizontal: true,
      axes: { x: axis('left'), y: axis('bottom', { ticks: 1000 }), y2: null },
      width: 390,
      height: 240,
      locale: 'zh-CN',
      measure,
    })
    expect(performance.now() - start).toBeLessThan(100)
  })

  it('keeps value labels apart down a short chart, even with more ticks asked', () => {
    const rows = [
      { k: 'a', v: 1 },
      { k: 'b', v: 100 },
    ]
    const model = buildModel([input(0, { y: 'v' })], { data: rows, x: 'k' })
    const labels = layoutChart({
      model,
      axes: { x: axis('bottom'), y: axis('left', { ticks: 20 }), y2: null },
      width: 400,
      height: 120,
      locale: 'zh-CN',
      measure,
    }).y.y!.labels
    for (let i = 1; i < labels.length; i++)
      expect(Math.abs(labels[i]!.top - labels[i - 1]!.top)).toBeGreaterThanOrEqual(19.5)
  })
})

const lay = (rows: Record<string, unknown>[], height = 300) =>
  layoutChart({
    model: buildModel([input(0, { y: 'a' }), input(1, { y: 'b', axis: 'y2' })], {
      data: rows,
      x: 'k',
    }),
    axes: { x: axis('bottom'), y: axis('left'), y2: axis('right') },
    width: 600,
    height,
    locale: 'zh-CN',
    measure,
  })

describe('two value axes', () => {
  it('puts 0 on one line when values go below it', () => {
    for (const height of [160, 240, 300, 420]) {
      const layout = lay(
        [
          { k: '甲', a: -20, b: -10 },
          { k: '乙', a: 40, b: 50 },
        ],
        height,
      )
      const y = layout.y.y!
      const y2 = layout.y.y2!
      expect(y2.scale.map(0)).toBeCloseTo(y.scale.map(0), 6)
      expect(y2.ticks.length).toBe(y.ticks.length)
      expect(y2.ticks.map((t) => y2.scale.map(t))).toEqual(y.ticks.map((t) => y.scale.map(t)))
      // both still show all their data
      expect(y.ticks[0]).toBeLessThanOrEqual(-20)
      expect(y.ticks.at(-1)).toBeGreaterThanOrEqual(40)
      expect(y2.ticks[0]).toBeLessThanOrEqual(-10)
      expect(y2.ticks.at(-1)).toBeGreaterThanOrEqual(50)
    }
  })

  it('makes room below 0 for an axis whose values stay above it', () => {
    const layout = lay([
      { k: '甲', a: -30, b: 5 },
      { k: '乙', a: 60, b: 80 },
    ])
    const y = layout.y.y!
    const y2 = layout.y.y2!
    expect(y2.scale.map(0)).toBeCloseTo(y.scale.map(0), 6)
    expect(y2.ticks[0]).toBeLessThan(0)
  })
})

describe('horizontal', () => {
  it('puts y2 along the top and cuts long names short', () => {
    const rows = [
      { k: '一个名字特别特别特别特别特别特别长的类目', v: 3, w: 30 },
      { k: '短', v: 5, w: 10 },
    ]
    const model = buildModel([input(0, { y: 'v' }), input(1, { y: 'w', axis: 'y2' })], {
      data: rows,
      x: 'k',
    })
    expect(model.y.y2).toEqual([10, 30])
    const layout = layoutChart({
      model,
      horizontal: true,
      axes: { x: axis('left'), y: axis('bottom', { grid: true }), y2: axis('top') },
      width: 300,
      height: 200,
      locale: 'zh-CN',
      measure,
    })
    const top = layout.y.y2!
    expect(top.position).toBe('top')
    for (const label of top.labels) expect(label.top).toBe(layout.plot.y - 8 - 16)
    // as many steps as the bottom axis, so they share grid lines
    expect(top.ticks.length).toBe(layout.y.y!.ticks.length)
    const [long, short] = layout.x.labels
    expect(long!.clipped).toBe(true)
    expect(long!.width).toBe(120)
    expect(short!.clipped).toBeUndefined()
    expect(layout.plot.x).toBe(4 + 120 + 8)
  })

  it('reads the x range as running down', async () => {
    const wrapper = mount(DouChart, {
      props: {
        data: [
          { k: '甲', v: 1 },
          { k: '乙', v: 2 },
        ],
        x: 'k',
        horizontal: true,
      },
      slots: { default: () => h(DouChartBar, { y: 'v' }) },
    })
    await nextTick()
    expect(wrapper.find('.dou-chart').attributes('aria-label')).toMatch(/^图表，纵轴从 甲 到 乙。/)
    wrapper.unmount()
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
      point: () => [0, 0],
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
      axes: { x: axis('bottom'), y: axis('left', { nice: false }), y2: null },
      width: 400,
      height: 300,
      locale: 'zh-CN',
      measure,
    })
    const { plot } = layout
    expect(layout.x.scale.map(10)).toBeCloseTo(plot.x + plot.width - 21)
    expect(layout.y.y!.scale.map(10)).toBeCloseTo(plot.y + 21)
  })
})

describe('pie', () => {
  it('goes round from the top, leaving out values of 0 or less', () => {
    const slices = pieSlices(
      [
        { k: 'a', v: 1, c: 'danger' },
        { k: 'b', v: 0 },
        { k: 'c', v: 3 },
      ],
      'v',
      'k',
      'c',
    )
    expect(slices.map((s) => s.color)).toEqual(['danger', undefined])
    expect(slices.map((s) => [s.label, s.share])).toEqual([
      ['a', 0.25],
      ['c', 0.75],
    ])
    expect(slices[0]!.start).toBe(0)
    expect(slices[1]!.end).toBeCloseTo(Math.PI * 2)
  })

  it('warns when slices outnumber the palette', async () => {
    const warn = console.warn
    const seen: string[] = []
    console.warn = (message: string) => seen.push(message)
    const rows = Array.from({ length: 9 }, (_, i) => ({ k: `${i}`, v: i + 1 }))
    const wrapper = mount(DouChart, {
      props: { data: rows, x: 'k' },
      slots: { default: () => h(DouChartPie, { value: 'v' }) },
    })
    await nextTick()
    await nextTick()
    console.warn = warn
    expect(seen.some((message) => message.includes('repeats colors after 7'))).toBe(true)
    wrapper.unmount()
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
    expect(root.getAttribute('aria-label')).toBe(
      '图表。支出：房租 3（75%）；餐饮 1（25%）。用方向键逐个查看数据',
    )
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
      type: 'tick',
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

  it('prepares once the data has stayed a moment, and keeps what it gives back', async () => {
    vi.useFakeTimers()
    const prepared: number[] = []
    const DouChartMark = defineChartSeries({
      type: 'mark',
      prepare: (series) => {
        prepared.push(series.top.length)
        return `${series.top.length} 个点`
      },
      draw: () => {},
    })
    const data = { x: new Float64Array([1, 2]), y: new Float64Array([4, 5]) }
    const wrapper = mount(DouChart, {
      props: { data, x: 'x' },
      slots: { default: () => [h(DouChartMark, { y: 'y' })] },
    })
    await nextTick()
    await vi.advanceTimersByTimeAsync(200)
    // new data before the old stayed long enough: only the new is prepared
    await wrapper.setProps({ data: { x: new Float64Array([1, 2, 3]), y: data.y } })
    await vi.advanceTimersByTimeAsync(1500)
    expect(prepared).toEqual([3])
    vi.useRealTimers()
    wrapper.unmount()
  })
})

/* helpers */

function axis(position: AxisConfig['position'], extra: Partial<AxisConfig> = {}): AxisConfig {
  return { position, grid: false, hidden: false, ...extra }
}

function measure(text: string) {
  return text.length * 7
}
