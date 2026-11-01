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
async function pair(group?: string) {
  const wrapper = mount(
    defineComponent(
      () => () =>
        h('div', [
          h(DouChart, { data: sales, x: 'q', height: 300 }, () => [
            h(DouChartBar, { y: 'a', name: '线上' }),
            h(DouChartTooltip, { group }),
          ]),
          h(DouChart, { data: visits, x: 'q', height: 300 }, () => [
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

  it('leave charts without a group alone', async () => {
    const { wrapper, roots, charts } = await pair()
    key(roots[0]!, 'ArrowRight')
    key(roots[0]!, 'ArrowRight')
    await nextTick()
    expect(charts[0]!.find('.dou-chart__tooltip').exists()).toBe(true)
    expect(charts[1]!.find('.dou-chart__tooltip').exists()).toBe(false)
    wrapper.unmount()
  })
})
