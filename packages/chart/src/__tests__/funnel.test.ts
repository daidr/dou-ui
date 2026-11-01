import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, type VNodeChild } from 'vue'
import { DouChart, DouChartFunnel, DouChartLine } from '..'
import { layoutFunnel } from '../core/layout'

// 一次活动从浏览到付款的人数
const steps = [
  { step: '浏览', users: 1000 },
  { step: '领券', users: 500 },
  { step: '下单', users: 200 },
]

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

const measure = (text: string) => text.length * 8

const key = (root: HTMLElement, name: string) =>
  root.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true }))

describe('funnel', () => {
  it('puts the names on the left and the values, lined up, on the right', () => {
    const f = layoutFunnel({
      width: 600,
      height: 300,
      measure,
      stages: ['浏览', '领券', '下单'],
      values: ['1,000', '500', '200'],
      rates: [null, '50%', '40%'],
      max: 1000,
    })
    expect(f.count).toBe(3)
    // the largest value takes the whole width: half of it either side of the middle
    expect(f.scale.map(1000)).toBeCloseTo(f.plot.width / 2)
    for (const name of f.names) expect(name.left + name.width).toBeLessThan(f.plot.x)
    const right = f.values.map((v) => v.left + v.width)
    expect(new Set(right).size).toBe(1)
    expect(f.values[0]!.left).toBeGreaterThan(f.plot.x + f.plot.width)
    expect(f.rates).toHaveLength(2)
    // a few stages: rows no taller than 64px, the funnel centered down the chart
    expect(f.step).toBe(64)
    expect(f.plot.y + f.plot.height / 2).toBeCloseTo(150, 0)
  })

  it('reads out each stage and what it kept, and walks the stages with up and down', async () => {
    const { wrapper, root } = await sized(() =>
      h(DouChart, { data: steps, x: 'step', height: 300 }, () => [
        h(DouChartFunnel, { y: 'users', name: '人数' }),
      ]),
    )
    expect(wrapper.find('.dou-chart').attributes('aria-label')).toContain(
      '人数：浏览 1,000；领券 500（转化率 50.0%）；下单 200（转化率 40.0%）',
    )
    expect(wrapper.findAll('.dou-chart__tick.is-rate').map((t) => t.text())).toEqual([
      '50.0%',
      '40.0%',
    ])
    const live = () => wrapper.find('.dou-chart__live').text()
    key(root, 'ArrowDown')
    await nextTick()
    expect(live()).toBe('浏览，人数 1,000')
    key(root, 'ArrowDown')
    key(root, 'ArrowDown')
    await nextTick()
    expect(live()).toBe('下单，人数 200，转化率 40.0%，总转化率 20.0%')
    expect(wrapper.find('.dou-chart__band').exists()).toBe(true)
    // left and right move between the stages too
    key(root, 'ArrowLeft')
    await nextTick()
    expect(live()).toBe('领券，人数 500，转化率 50.0%，总转化率 50.0%')
    wrapper.unmount()
  })

  it('lists the stages in the table, with both rates', async () => {
    const wrapper = mount(DouChart, {
      props: { data: steps, x: 'step', table: true },
      slots: { default: () => [h(DouChartFunnel, { y: 'users', name: '人数' })] },
      attachTo: document.body,
    })
    await nextTick()
    await nextTick()
    const cells = wrapper
      .findAll('.dou-chart__table tr')
      .map((tr) => tr.findAll('th, td').map((c) => c.text()))
    expect(cells).toEqual([
      ['step', '人数', '转化率', '总转化率'],
      ['浏览', '1,000', '', '100.0%'],
      ['领券', '500', '50.0%', '50.0%'],
      ['下单', '200', '40.0%', '20.0%'],
    ])
    wrapper.unmount()
  })

  it('warns when other series are put with it', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const wrapper = mount(DouChart, {
      props: { data: steps, x: 'step' },
      slots: {
        default: () => [h(DouChartFunnel, { y: 'users' }), h(DouChartLine, { y: 'users' })],
      },
    })
    await nextTick()
    expect(warn.mock.calls.some(([text]) => String(text).includes('DouChartFunnel'))).toBe(true)
    warn.mockRestore()
    wrapper.unmount()
  })
})
