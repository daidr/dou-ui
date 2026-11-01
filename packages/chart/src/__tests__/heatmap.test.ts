import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, type VNodeChild } from 'vue'
import { DouChart, DouChartAxis, DouChartHeatmap } from '..'
import { heatColor, heatmapKind, heatRange, heatShare } from '../core/heatmap'
import { layoutChart } from '../core/layout'
import { buildModel } from '../core/model'

// 两家门店三个季度的达成率，按门店、季度给出
const rates = [
  { store: '上海徐汇店', q: '一季度', rate: 0.8 },
  { store: '上海徐汇店', q: '二季度', rate: 1.1 },
  { store: '上海静安店', q: '一季度', rate: 0.9 },
  { store: '上海静安店', q: '二季度', rate: 1.2 },
  { store: '上海静安店', q: '三季度', rate: 1 },
]

const percent = (value: number) => `${Math.round(value * 100)}%`

async function sized(render: () => VNodeChild, width = 600, height = 300) {
  const wrapper = mount(
    defineComponent(() => render),
    { attachTo: document.body },
  )
  const root = wrapper.find('.dou-chart').element as HTMLElement
  root.getBoundingClientRect = () => ({ left: 0, top: 0, width, height }) as DOMRect
  Object.defineProperty(root, 'clientWidth', { value: width })
  Object.defineProperty(root, 'clientHeight', { value: height })
  window.dispatchEvent(new Event('resize'))
  ;(root.style as CSSStyleDeclaration).width = `${width}px`
  await new Promise((done) => setTimeout(done, 20))
  await nextTick()
  return { wrapper, root }
}

const key = (root: HTMLElement, name: string) =>
  root.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true }))

describe('heatmap', () => {
  it('mixes its colors from the surface to its own, the least still showing', () => {
    expect(heatShare(5, [0, 10])).toBe(0.5)
    expect(heatShare(-1, [0, 10])).toBe(0)
    expect(heatShare(20, [0, 10])).toBe(1)
    expect(heatColor('#000000', '#ffffff', 1)).toBe('rgb(0, 0, 0)')
    // the least is a little off the surface
    expect(heatColor('#000000', '#ffffff', 0)).not.toBe('rgb(255, 255, 255)')
    const middle = heatColor('rgb(0, 0, 0)', 'rgb(255, 255, 255)', 0.5)
    expect(middle).toMatch(/^rgb\((\d+), \1, \1\)$/)
    const y = Float64Array.from([3, 1, 7])
    expect(heatRange({ props: {} as never, y })).toEqual([1, 7])
    expect(heatRange({ props: { min: 0, max: 10 } as never, y })).toEqual([0, 10])
    // one end given: the other is the data's
    expect(heatRange({ props: { min: 0 } as never, y })).toEqual([0, 7])
  })

  it('lists its rows down the value axis in the order they come, the first at the top', () => {
    const model = buildModel(
      [{ index: 0, kind: heatmapKind, props: { y: 'store', value: 'rate' } as never }],
      { data: rates, x: 'q' },
    )
    expect(model.yCategories.y).toEqual(['上海徐汇店', '上海静安店'])
    expect([...model.series[0]!.top]).toEqual([0, 0, 1, 1, 1])
    expect([...model.series[0]!.y]).toEqual([0.8, 1.1, 0.9, 1.2, 1])
    const layout = layoutChart({
      model,
      axes: {
        x: { position: 'bottom', grid: false, hidden: false },
        y: { position: 'left', grid: false, hidden: false },
        y2: null,
      },
      width: 600,
      height: 300,
      locale: 'zh-CN',
      measure: (text) => text.length * 7,
    })
    const y = layout.y.y!
    // the first row above the second
    expect(y.scale.map(0)).toBeLessThan(y.scale.map(1))
    expect(y.labels.map((label) => label.text)).toEqual(['上海徐汇店', '上海静安店'])
  })

  it('reads out its size and largest cell, and shows its scale in the legend', async () => {
    const { wrapper } = await sized(() =>
      h(DouChart, { data: rates, x: 'q', height: 300 }, () => [
        h(DouChartAxis, { for: 'y', title: '门店' }),
        h(DouChartHeatmap, { y: 'store', value: 'rate', name: '达成率', format: percent }),
      ]),
    )
    expect(wrapper.find('.dou-chart').attributes('aria-label')).toContain(
      '达成率：2 行 3 列，最小 80%，最大 120%（上海静安店，二季度）',
    )
    // a heatmap alone still has a legend: its scale
    const legend = wrapper.findAll('.dou-chart__legend')
    expect(legend.map((item) => item.text())).toEqual(['80% – 120%'])
    expect(legend[0]!.classes()).toContain('is-heatmap')
    expect(legend[0]!.find('.dou-chart__swatch').attributes('style')).toContain('linear-gradient')
    wrapper.unmount()
  })

  it('walks along a row with left and right, and between rows with up and down', async () => {
    const { wrapper, root } = await sized(() =>
      h(DouChart, { data: rates, x: 'q', height: 300 }, () => [
        h(DouChartHeatmap, { y: 'store', value: 'rate', name: '达成率', format: percent }),
      ]),
    )
    const live = () => wrapper.find('.dou-chart__live').text()
    key(root, 'ArrowRight')
    await nextTick()
    expect(live()).toBe('上海徐汇店，一季度，达成率 80%')
    expect(wrapper.find('.dou-chart__cell').exists()).toBe(true)
    key(root, 'ArrowRight')
    await nextTick()
    expect(live()).toBe('上海徐汇店，二季度，达成率 110%')
    // the first store has no third quarter: right stays at its row's end
    key(root, 'ArrowRight')
    await nextTick()
    expect(live()).toBe('上海徐汇店，二季度，达成率 110%')
    key(root, 'ArrowDown')
    await nextTick()
    expect(live()).toBe('上海静安店，二季度，达成率 120%')
    key(root, 'End')
    await nextTick()
    expect(live()).toBe('上海静安店，三季度，达成率 100%')
    // up from a column the row above has no cell in: it stays
    key(root, 'ArrowUp')
    await nextTick()
    expect(live()).toBe('上海静安店，三季度，达成率 100%')
    wrapper.unmount()
  })

  it('lays its data out in the table as the grid it draws', async () => {
    const wrapper = mount(DouChart, {
      props: { data: rates, x: 'q', table: true },
      slots: {
        default: () => [
          h(DouChartAxis, { for: 'y', title: '门店' }),
          h(DouChartHeatmap, { y: 'store', value: 'rate', name: '达成率', format: percent }),
        ],
      },
      attachTo: document.body,
    })
    await nextTick()
    await nextTick()
    const cells = wrapper
      .findAll('.dou-chart__table tr')
      .map((tr) => tr.findAll('th, td').map((c) => c.text()))
    expect(cells).toEqual([
      ['门店', '一季度', '二季度', '三季度'],
      ['上海徐汇店', '80%', '110%', ''],
      ['上海静安店', '90%', '120%', '100%'],
    ])
    wrapper.unmount()
  })
})
