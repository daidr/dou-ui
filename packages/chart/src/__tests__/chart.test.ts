import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { DouChart, DouChartArea, DouChartAxis, DouChartLine } from '..'
import { layoutChart, type AxisConfig } from '../core/layout'
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
    expect(root.attributes('role')).toBe('img')
    expect(root.attributes('aria-label')).toBe('图表。数量：3 个数据点，最小 10，最大 30')
    showFirst.value = true
    await nextTick()
    await nextTick()
    expect(root.attributes('aria-label')).toMatch(/^图表。比率：.*；数量：/)
  })

  it('uses the description when given', () => {
    const wrapper = mount(DouChart, {
      props: { data: rows, x: 'm', description: '月度数量' },
      slots: { default: () => h(DouChartLine, { y: 'a' }) },
    })
    expect(wrapper.find('.dou-chart').attributes('aria-label')).toBe('月度数量')
  })

  it('warns when a part is used outside a chart', () => {
    const warn = console.warn
    const seen: string[] = []
    console.warn = (message: string) => seen.push(message)
    mount(DouChartAxis, { props: { position: 'left' } })
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
        { index: 1, kind: lineKind, props: { y: 'b', axis: 'right' } as never },
      ],
      { data: rows, x: 'm' },
    )
    const layout = layoutChart({
      model,
      axes: { bottom: axis('bottom'), left: axis('left'), right: axis('right') },
      width: 600,
      height: 300,
      locale: 'zh-CN',
      measure,
    })
    const left = layout.y.left!
    const right = layout.y.right!
    expect(layout.plot.x).toBe(Math.max(...left.labels.map((l) => l.width)) + 8)
    expect(right.ticks.length).toBe(left.ticks.length)
    // the same pixel rows
    expect(right.ticks.map((t) => right.scale.map(t))).toEqual(
      left.ticks.map((t) => left.scale.map(t)),
    )
    expect(layout.x.labels.map((l) => l.text)).toEqual(['一月', '二月', '三月'])
  })

  it('shows fewer category labels when they do not fit', () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ k: `第 ${i + 1} 项`, v: i }))
    const model = buildModel([{ index: 0, kind: lineKind, props: { y: 'v' } as never }], {
      data: many,
      x: 'k',
    })
    const layout = layoutChart({
      model,
      axes: { bottom: axis('bottom'), left: axis('left'), right: null },
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
