import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { DouChart, DouChartBar, DouChartLine, DouChartTooltip } from '..'

const sales = [
  { q: '一季度', a: 120, b: 90 },
  { q: '二季度', a: 150, b: 100 },
  { q: '三季度', a: 140, b: 110 },
]
const visits = [
  { q: '二季度', v: 30 },
  { q: '三季度', v: 40 },
  { q: '四季度', v: 50 },
]

const key = (root: Element, name: string) =>
  root.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true }))

/** Two charts in one tooltip group (or none), each with a size, as happy-dom has no layout. */
async function pair(group?: string, onHover?: (event: unknown) => void) {
  const wrapper = mount(
    defineComponent(
      () => () =>
        h('div', [
          h(DouChart, { data: sales, x: 'q', height: 300 }, () => [
            h(DouChartBar, { y: 'a', name: '线上' }),
            h(DouChartTooltip, { group }),
          ]),
          h(DouChart, { data: visits, x: 'q', height: 300, onHover }, () => [
            h(DouChartLine, { y: 'v', name: '访客' }),
            h(DouChartTooltip, { group }),
          ]),
        ]),
    ),
    { attachTo: document.body },
  )
  const roots = wrapper.findAll('.dou-chart').map((r) => r.element as HTMLElement)
  for (const root of roots) {
    root.getBoundingClientRect = () => ({ left: 0, top: 0, width: 600, height: 300 }) as DOMRect
    Object.defineProperty(root, 'clientWidth', { value: 600 })
    Object.defineProperty(root, 'clientHeight', { value: 300 })
    root.style.width = '600px'
  }
  window.dispatchEvent(new Event('resize'))
  await new Promise((done) => setTimeout(done, 20))
  await nextTick()
  const charts = wrapper.findAll('.dou-chart')
  return { wrapper, roots, charts }
}

/** Where the legend box starts, in px, on a chart `width` wide with the legend asked down the side. */
async function sideLegendLeft(width: number) {
  const wrapper = mount(DouChart, {
    props: { data: sales, x: 'q', height: 300, legendPlacement: 'right' },
    slots: {
      default: () => [
        h(DouChartBar, { y: 'a', name: '线上' }),
        h(DouChartBar, { y: 'b', name: '门店' }),
      ],
    },
    attachTo: document.body,
  })
  const root = wrapper.find('.dou-chart').element as HTMLElement
  root.getBoundingClientRect = () => ({ left: 0, top: 0, width, height: 300 }) as DOMRect
  Object.defineProperty(root, 'clientWidth', { value: width })
  Object.defineProperty(root, 'clientHeight', { value: 300 })
  root.style.width = `${width}px`
  window.dispatchEvent(new Event('resize'))
  await new Promise((done) => setTimeout(done, 20))
  await nextTick()
  const box = wrapper.find('.dou-chart__legends').element as HTMLElement
  const left = Number.parseFloat(box.style.left)
  wrapper.unmount()
  return left
}

describe('tooltips in a group', () => {
  it('show the same category in each chart, read out only in the one with the keys', async () => {
    const { wrapper, roots, charts } = await pair('sales')
    key(roots[0]!, 'ArrowRight')
    await nextTick()
    // the first quarter: the other chart has none
    expect(charts[1]!.find('.dou-chart__tooltip').exists()).toBe(false)
    key(roots[0]!, 'ArrowRight')
    await nextTick()
    expect(charts[0]!.find('.dou-chart__tooltip-title').text()).toBe('二季度')
    expect(charts[1]!.find('.dou-chart__tooltip-title').text()).toBe('二季度')
    expect(charts[1]!.find('.dou-chart__tooltip-item').text()).toBe('访客30')
    expect(charts[0]!.find('.dou-chart__live').text()).toContain('二季度')
    expect(charts[1]!.find('.dou-chart__live').text()).toBe('')
    key(roots[0]!, 'Escape')
    await nextTick()
    expect(charts[1]!.find('.dou-chart__tooltip').exists()).toBe(false)
    wrapper.unmount()
  })

  it('tell hover only in the chart the pointer or keys are on', async () => {
    const hovered: unknown[] = []
    const { wrapper, roots } = await pair('sales', (event) => hovered.push(event))
    key(roots[0]!, 'End')
    await nextTick()
    // the second chart follows to 三季度, but nothing was hovered there
    expect(hovered).toEqual([])
    key(roots[1]!, 'ArrowRight')
    await nextTick()
    expect(hovered).toHaveLength(1)
    wrapper.unmount()
  })

  it('leave charts without a group alone', async () => {
    const { wrapper, roots, charts } = await pair()
    key(roots[0]!, 'ArrowRight')
    key(roots[0]!, 'ArrowRight')
    await nextTick()
    expect(charts[0]!.find('.dou-chart__tooltip').exists()).toBe(true)
    expect(charts[1]!.find('.dou-chart__tooltip').exists()).toBe(false)
    wrapper.unmount()
  })

  it('keeps a legend down the side only on a chart wide enough for it', async () => {
    const wide = await sideLegendLeft(800)
    const narrow = await sideLegendLeft(390)
    // down the side: the box starts near the right edge; under the chart: across its width
    expect(wide).toBeGreaterThan(600)
    expect(narrow).toBeLessThan(0)
  })
})
