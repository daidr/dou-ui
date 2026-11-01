import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, type VNodeChild } from 'vue'
import { DouChart, DouChartLine, DouChartRadar } from '..'
import { layoutRadar } from '../core/layout'
import { buildModel } from '../core/model'
import { nearestSpoke, radarKind, spokeAngle } from '../core/radar'

// 两款手机在四个方面的评分
const scores = [
  { item: '性能', a: 90, b: 70 },
  { item: '续航', a: 60, b: 85 },
  { item: '拍照', a: 80, b: 75 },
  { item: '价格', a: 50, b: 90 },
]

async function sized(render: () => VNodeChild, width = 600, height = 360) {
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

const measure = (text: string) => text.length * 12

const key = (root: HTMLElement, name: string) =>
  root.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true }))

const radar = () =>
  h(DouChart, { data: scores, x: 'item', height: 360 }, () => [
    h(DouChartRadar, { y: 'a', name: '旗舰款' }),
    h(DouChartRadar, { y: 'b', name: '轻薄款' }),
  ])

describe('radar', () => {
  it('spreads its spokes clockwise from 12 o’clock, and finds the nearest', () => {
    expect(spokeAngle(0, 4)).toBe(0)
    expect(spokeAngle(1, 4)).toBeCloseTo(Math.PI / 2)
    expect(nearestSpoke(0.2, 4)).toBe(0)
    expect(nearestSpoke(Math.PI * 0.6, 4)).toBe(1)
    // just short of a full turn is the first spoke again
    expect(nearestSpoke(Math.PI * 1.95, 4)).toBe(0)
  })

  it('leaves room round the circle for the names, and starts its rings at 0', () => {
    const model = buildModel([{ index: 0, kind: radarKind, props: { y: 'a' } as never }], {
      data: scores,
      x: 'item',
    })
    expect(model.xKind).toBe('category')
    const r = layoutRadar({
      model,
      axes: {
        x: { position: 'bottom', grid: false, hidden: false },
        y: { position: 'left', grid: true, hidden: false },
        y2: null,
      },
      width: 600,
      height: 360,
      locale: 'zh-CN',
      measure,
      spokes: scores.map((row) => row.item),
    })
    expect(r.count).toBe(4)
    expect(r.scale.domain[0]).toBe(0)
    expect(r.ticks[0]).toBe(0)
    const [top, right, bottom, left] = r.labels
    // the top name above the rim, centered; the right one starts past it; the left one ends before it
    expect(top!.top + 16).toBeLessThanOrEqual(r.cy - r.radius)
    expect(top!.left + top!.width / 2).toBeCloseTo(r.cx)
    expect(right!.left).toBeGreaterThan(r.cx + r.radius)
    expect(left!.left + left!.width).toBeLessThan(r.cx - r.radius)
    expect(bottom!.top).toBeGreaterThan(r.cy + r.radius)
    expect(left!.left).toBeGreaterThanOrEqual(0)
    expect(r.cy + r.radius + 8 + 16).toBeLessThanOrEqual(360)
    // every ring but the center has its value, the outermost too, between the first two spokes
    expect(r.values).toHaveLength(r.ticks.length - 1)
    for (const value of r.values) expect(value.left).toBeGreaterThan(r.cx)
    // the rings' values don't run into the top name
    for (const value of r.values)
      expect(value.top + 16 <= top!.top || value.top >= top!.top + 16).toBe(true)
  })

  it('reads out each series without an x range, and walks round the spokes with the keys', async () => {
    const { wrapper, root } = await sized(radar)
    const label = wrapper.find('.dou-chart').attributes('aria-label')!
    expect(label).toContain('旗舰款：4 个数据点，最小 50，最大 90')
    expect(label).not.toContain('横轴')
    expect(wrapper.findAll('.dou-chart__legend').map((item) => item.text())).toEqual([
      '旗舰款',
      '轻薄款',
    ])
    expect(wrapper.findAll('.dou-chart__tick.is-spoke').map((tick) => tick.text())).toEqual(
      scores.map((row) => row.item),
    )
    const live = () => wrapper.find('.dou-chart__live').text()
    key(root, 'ArrowRight')
    await nextTick()
    expect(live()).toBe('性能，旗舰款 90，轻薄款 70')
    expect(wrapper.findAll('.dou-chart__mark')).toHaveLength(2)
    // back past the first spoke: round to the last
    key(root, 'ArrowLeft')
    await nextTick()
    expect(live()).toBe('价格，旗舰款 50，轻薄款 90')
    // down and up move round the spokes too
    key(root, 'ArrowDown')
    await nextTick()
    expect(live()).toBe('性能，旗舰款 90，轻薄款 70')
    key(root, 'ArrowUp')
    await nextTick()
    expect(live()).toBe('价格，旗舰款 50，轻薄款 90')
    wrapper.unmount()
  })

  it('lists each spoke as a row of the table', async () => {
    const wrapper = mount(DouChart, {
      props: { data: scores, x: 'item', table: true },
      slots: {
        default: () => [
          h(DouChartRadar, { y: 'a', name: '旗舰款' }),
          h(DouChartRadar, { y: 'b', name: '轻薄款' }),
        ],
      },
      attachTo: document.body,
    })
    await nextTick()
    await nextTick()
    const cells = wrapper
      .findAll('.dou-chart__table tr')
      .map((tr) => tr.findAll('th, td').map((c) => c.text()))
    expect(cells[0]).toEqual(['item', '旗舰款', '轻薄款'])
    expect(cells[1]).toEqual(['性能', '90', '70'])
    wrapper.unmount()
  })

  it('warns when series on axes are put with it', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const wrapper = mount(DouChart, {
      props: { data: scores, x: 'item' },
      slots: { default: () => [h(DouChartRadar, { y: 'a' }), h(DouChartLine, { y: 'b' })] },
    })
    await nextTick()
    expect(warn.mock.calls.some(([text]) => String(text).includes('DouChartRadar'))).toBe(true)
    warn.mockRestore()
    wrapper.unmount()
  })
})
