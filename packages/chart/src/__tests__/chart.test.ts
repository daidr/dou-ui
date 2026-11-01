import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { DouChart, DouChartArea, DouChartAxis, DouChartLine } from '..'
import { layoutChart, placeLegendIn, type AxisConfig } from '../core/layout'
import { lineKind } from '../core/line'
import { buildModel } from '../core/model'

const rows = [
  { m: '一月', a: 10, b: 0.2 },
  { m: '二月', a: 30, b: 0.5 },
  { m: '三月', a: 20, b: 0.4 },
]

describe('DouChart', () => {
  it('reads out each series, in the order written', async () => {
    const showFirst = ref(false)
    const wrapper = mount(
      defineComponent(
        () => () =>
          h(DouChart, { data: rows, x: 'm' }, () => [
            showFirst.value ? h(DouChartLine, { y: 'b', name: '比率' }) : null,
            h(DouChartArea, { y: 'a', name: '数量' }),
          ]),
      ),
    )
    await nextTick()
    const root = wrapper.find('.dou-chart')
    // it can be explored with the keys
    expect(root.attributes('role')).toBe('group')
    expect(root.attributes('tabindex')).toBe('0')
    expect(root.attributes('aria-label')).toBe(
      '图表，横轴从 一月 到 三月。数量：3 个数据点，最小 10，最大 30。用方向键逐个查看数据',
    )
    showFirst.value = true
    await nextTick()
    await nextTick()
    expect(root.attributes('aria-label')).toMatch(/^图表，横轴从 一月 到 三月。比率：.*；数量：/)
  })

  it('uses aria-label when given', () => {
    const wrapper = mount(DouChart, {
      props: { data: rows, x: 'm', ariaLabel: '月度数量' },
      slots: { default: () => h(DouChartLine, { y: 'a' }) },
    })
    expect(wrapper.find('.dou-chart').attributes('aria-label')).toBe('月度数量')
  })

  it('reads values the way their axis shows them', async () => {
    const wrapper = mount(DouChart, {
      props: { data: rows, x: 'm' },
      slots: {
        default: () => [
          h(DouChartAxis, { for: 'y2', format: (v: number) => `${v * 100}%` }),
          h(DouChartLine, { y: 'b', name: '比率' }),
        ],
      },
    })
    await nextTick()
    expect(wrapper.find('.dou-chart').attributes('aria-label')).toContain('最小 20%，最大 50%')
  })

  it('shows the empty slot when no series has a value', async () => {
    const wrapper = mount(DouChart, {
      props: { data: [{ m: 'a', v: null }], x: 'm' },
      slots: { default: () => h(DouChartLine, { y: 'v' }), empty: () => '还没有记录' },
    })
    await nextTick()
    expect(wrapper.find('.dou-chart__empty').text()).toBe('还没有记录')
    expect(wrapper.find('.dou-chart').attributes('aria-label')).toBe('图表。没有数据')
  })

  it('shows a legend for more than one series, and reads years as written', async () => {
    const years = [2019, 2025].map((year) => ({ year, a: 1, b: 2 }))
    const wrapper = mount(DouChart, {
      props: { data: years, x: 'year' },
      slots: { default: () => [h(DouChartLine, { y: 'a' }), h(DouChartLine, { y: 'b' })] },
      attachTo: document.body,
    })
    // happy-dom has no layout: give the chart a size
    const root = wrapper.find('.dou-chart').element as HTMLElement
    root.getBoundingClientRect = () => ({ width: 600, height: 300 }) as DOMRect
    Object.defineProperty(root, 'clientWidth', { value: 600 })
    Object.defineProperty(root, 'clientHeight', { value: 300 })
    await wrapper.setProps({ height: 300 })
    expect(wrapper.find('.dou-chart').attributes('aria-label')).toContain('横轴从 2019 到 2025')
    await nextTick()
    expect(wrapper.findAll('.dou-chart__legend').map((item) => item.text())).toEqual(['a', 'b'])
    await wrapper.setProps({ legend: false })
    expect(wrapper.findAll('.dou-chart__legend')).toHaveLength(0)
    wrapper.unmount()
  })

  it('takes a format written inline without laying out again and again', async () => {
    const warn = console.warn
    const seen: string[] = []
    console.warn = (message: string) => seen.push(String(message))
    const wrapper = mount(DouChart, {
      props: {
        data: [
          { m: 'a', v: 0.2 },
          { m: 'b', v: 0.6 },
        ],
        x: 'm',
      },
      // a new function on every render of the slot
      slots: {
        default: () => [
          h(DouChartLine, { y: 'v' }),
          h(DouChartAxis, { for: 'y', format: (v: number) => `${Math.round(v * 100)}%` }),
        ],
      },
      attachTo: document.body,
    })
    const root = wrapper.find('.dou-chart').element as HTMLElement
    root.getBoundingClientRect = () => ({ width: 600, height: 300 }) as DOMRect
    Object.defineProperty(root, 'clientWidth', { value: 600 })
    Object.defineProperty(root, 'clientHeight', { value: 300 })
    await wrapper.setProps({ height: 300 })
    await nextTick()
    await nextTick()
    console.warn = warn
    expect(seen.filter((m) => m.includes('recursive'))).toEqual([])
    expect(wrapper.findAll('.dou-chart__tick').map((t) => t.text())).toContain('60%')
    wrapper.unmount()
  })

  it('warns when a part is used outside a chart', () => {
    const warn = console.warn
    const seen: string[] = []
    console.warn = (message: string) => seen.push(message)
    mount(DouChartAxis, { props: { for: 'y' } })
    console.warn = warn
    expect(seen[0]).toContain('<DouChartAxis> must be placed inside <DouChart>')
  })
})

/* layout */

const axis = (position: AxisConfig['position'], extra: Partial<AxisConfig> = {}): AxisConfig => ({
  position,
  grid: position === 'left',
  hidden: false,
  ...extra,
})
const measure = (text: string) => text.length * 7

describe('layout', () => {
  it('makes room for the widest value label and lines two axes up', () => {
    const model = buildModel(
      [
        { index: 0, kind: lineKind, props: { y: 'a' } as never },
        { index: 1, kind: lineKind, props: { y: 'b', axis: 'y2' } as never },
      ],
      { data: rows, x: 'm' },
    )
    const layout = layoutChart({
      model,
      axes: { x: axis('bottom'), y: axis('left'), y2: axis('right') },
      width: 600,
      height: 300,
      locale: 'zh-CN',
      measure,
    })
    const left = layout.y.y!
    const right = layout.y.y2!
    expect(layout.plot.x).toBe(4 + Math.max(...left.labels.map((l) => l.width)) + 8)
    expect(right.ticks.length).toBe(left.ticks.length)
    // the same pixel rows
    expect(right.ticks.map((t) => right.scale.map(t))).toEqual(
      left.ticks.map((t) => left.scale.map(t)),
    )
    expect(layout.x.labels.map((l) => l.text)).toEqual(['一月', '二月', '三月'])
  })

  it('puts a legend above, below or down the side, scrolling what doesn’t fit', () => {
    const names = Array.from({ length: 30 }, (_, i) => `系列${i + 1}`)
    const below = placeLegendIn(names, 'bottom', 300, 200, measure)
    // three rows show, the rest scroll
    expect(below.box!.scroll).toBe(true)
    expect(below.box!.height).toBe(16 * 3 + 4 * 2)
    expect(below.room.bottom).toBeGreaterThan(below.box!.height)
    const above = placeLegendIn(['甲', '乙'], 'top', 300, 200, measure)
    expect(above.room.top).toBeGreaterThan(0)
    expect(above.room.bottom).toBe(0)
    expect(above.box!.scroll).toBe(false)
    const side = placeLegendIn(['很长很长很长很长的系列名称', '乙'], 'right', 300, 200, measure)
    // at most 30% of the width, the long name cut short
    expect(side.room.right).toBeLessThanOrEqual(300 * 0.3 + 16)
    expect(side.legend[0]!.clipped).toBe(true)
    expect(side.legend[1]!.top).toBeGreaterThan(side.legend[0]!.top)
    // on a touch screen, rows far enough apart for a finger
    const coarse = placeLegendIn(names, 'bottom', 300, 200, measure, true)
    expect(
      coarse.legend.find((item) => item.top > coarse.legend[0]!.top)!.top - coarse.legend[0]!.top,
    ).toBe(40)
  })

  it('puts a legend under the chart and keeps labels off the sides', () => {
    const model = buildModel(
      [
        { index: 0, kind: lineKind, props: { y: 'a' } as never },
        { index: 1, kind: lineKind, props: { y: 'b' } as never },
      ],
      { data: rows, x: 'm' },
    )
    const layout = layoutChart({
      model,
      axes: { x: axis('bottom'), y: axis('left'), y2: null },
      width: 300,
      height: 200,
      locale: 'zh-CN',
      measure,
      legend: ['数量', '比率'],
    })
    expect(layout.legend.map((item) => item.top)).toEqual([184, 184])
    expect(layout.plot.y + layout.plot.height).toBeLessThan(184 - 16)
    for (const label of layout.x.labels) {
      expect(label.left).toBeGreaterThanOrEqual(4)
      expect(label.left + label.width).toBeLessThanOrEqual(296)
    }
  })

  it('shows years as they are, one tick per year at most', () => {
    const years = [2019, 2020, 2021, 2022, 2023].map((year, i) => ({ year, v: i }))
    const model = buildModel([{ index: 0, kind: lineKind, props: { y: 'v' } as never }], {
      data: years,
      x: 'year',
    })
    const layout = layoutChart({
      model,
      axes: { x: axis('bottom'), y: axis('left'), y2: null },
      width: 1200,
      height: 200,
      locale: 'zh-CN',
      measure,
    })
    expect(layout.x.labels.map((l) => l.text)).toEqual(['2019', '2020', '2021', '2022', '2023'])
  })

  it('measures series on the only value axis written', () => {
    const model = buildModel([{ index: 0, kind: lineKind, props: { y: 'a' } as never }], {
      data: rows,
      x: 'm',
      axis: 'y2',
    })
    expect(model.y.y2).toEqual([10, 30])
    expect(model.y.y).toBeNull()
  })

  it('shows fewer category labels when they do not fit', () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ k: `第 ${i + 1} 项`, v: i }))
    const model = buildModel([{ index: 0, kind: lineKind, props: { y: 'v' } as never }], {
      data: many,
      x: 'k',
    })
    const layout = layoutChart({
      model,
      axes: { x: axis('bottom'), y: axis('left'), y2: null },
      width: 400,
      height: 200,
      locale: 'zh-CN',
      measure,
    })
    const labels = layout.x.labels
    expect(labels.length).toBeLessThan(40)
    for (let i = 1; i < labels.length; i++)
      expect(labels[i]!.left).toBeGreaterThanOrEqual(labels[i - 1]!.left + labels[i - 1]!.width + 8)
  })
})
