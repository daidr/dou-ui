import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'
import { DouSparkline } from '../../../index'

afterEach(() => {
  document.body.innerHTML = ''
})

const tooltip = () => document.querySelector<HTMLElement>('.dou-sparkline__tooltip')!

describe('DouSparkline', () => {
  it('draws a line and describes it for screen readers', () => {
    const wrapper = mount(DouSparkline, { props: { data: [3, 1, 4, 1, 5] } })
    const root = wrapper.get('.dou-sparkline')
    expect(root.attributes('role')).toBe('img')
    expect(root.attributes('aria-label')).toBe('5 个数据，最低 1，最高 5，最新 5')
    expect(wrapper.get('.dou-sparkline__line').attributes('d')).toBe(
      'M0 50L250 100L500 25L750 100L1000 0',
    )
    expect(wrapper.find('.dou-sparkline__area').exists()).toBe(false)
  })

  it('fills the area down to zero, or to the bottom when zero is out of range', () => {
    const wrapper = mount(DouSparkline, { props: { data: [2, 4], type: 'area' } })
    expect(wrapper.get('.dou-sparkline__area').attributes('d')).toBe(
      'M0 100L1000 0L1000 100L0 100Z',
    )
  })

  it('handles empty data, a single value and gaps', async () => {
    const wrapper = mount(DouSparkline, { props: { data: [] } })
    expect(wrapper.find('.dou-sparkline__line').exists()).toBe(false)
    expect(wrapper.get('.dou-sparkline').attributes('aria-label')).toBe('暂无数据')
    expect(wrapper.get('.dou-sparkline').attributes('tabindex')).toBeUndefined()

    await wrapper.setProps({ data: [5] })
    expect(wrapper.find('.dou-sparkline__line').exists()).toBe(false)
    expect(wrapper.findAll('.dou-sparkline__dot')).toHaveLength(1)

    await wrapper.setProps({ data: [1, 2, null, 3, null, 4, 5] })
    const d = wrapper.get('.dou-sparkline__line').attributes('d')!
    expect(d.match(/M/g)).toHaveLength(2)
    // the 3 between two gaps has no neighbor to join, so it is a dot
    expect(wrapper.findAll('.dou-sparkline__dot')).toHaveLength(1)
  })

  it('marks the requested points once each', () => {
    const wrapper = mount(DouSparkline, {
      props: { data: [2, 8, 1, 8], markers: ['min', 'max', 'last'] },
    })
    const markers = wrapper.findAll('.dou-sparkline__marker')
    expect(markers.map((marker) => marker.attributes('data-kind'))).toEqual(['min', 'max', 'last'])
    const max = markers[1]!.attributes('style')
    expect(max).toContain('left: 33.3')
    expect(max).toContain('top: 0%')
  })

  it('draws bars from zero', () => {
    const wrapper = mount(DouSparkline, { props: { data: [5, -5, 0], type: 'bar' } })
    const bars = wrapper.findAll('.dou-sparkline__bar')
    expect(bars).toHaveLength(3)
    expect(bars[0]!.attributes('style')).toContain('top: 0%; height: 50%')
    expect(bars[1]!.attributes('style')).toContain('top: 50%; height: 50%')
    expect(bars[1]!.classes()).toContain('is-down')
    expect(bars[2]!.attributes('style')).toContain('height: 0%')
  })

  it('steps through values with the keyboard and shows them in a tooltip', async () => {
    const wrapper = mount(DouSparkline, {
      attachTo: document.body,
      props: { data: [1, null, { value: 3, label: '周三' }, 4], format: (v: number) => `${v} 次` },
    })
    const root = wrapper.get('.dou-sparkline')
    expect(root.attributes('tabindex')).toBe('0')
    await root.trigger('focus')
    await nextTick()
    expect(tooltip().textContent).toBe('4 次')
    expect(root.attributes('aria-describedby')).toBe(tooltip().id)

    await root.trigger('keydown', { key: 'ArrowLeft' })
    expect(tooltip().textContent).toBe('周三：3 次')
    // the gap is skipped
    await root.trigger('keydown', { key: 'ArrowLeft' })
    expect(tooltip().textContent).toBe('1 次')
    await root.trigger('keydown', { key: 'End' })
    expect(tooltip().textContent).toBe('4 次')
    await root.trigger('keydown', { key: 'Escape' })
    expect(root.attributes('aria-describedby')).toBeUndefined()
    wrapper.unmount()
  })

  it('stays still when not interactive', () => {
    const wrapper = mount(DouSparkline, { props: { data: [1, 2], interactive: false } })
    expect(wrapper.get('.dou-sparkline').attributes('tabindex')).toBeUndefined()
  })

  it('keeps long series cheap to draw', () => {
    const data = Array.from({ length: 100_000 }, (_, i) => Math.sin(i / 300) * 100 + (i % 7))
    data[54_321] = 1000
    const started = performance.now()
    const wrapper = mount(DouSparkline, { props: { data, width: 200, markers: ['max'] } })
    const elapsed = performance.now() - started
    const d = wrapper.get('.dou-sparkline__line').attributes('d')!
    // at most two points per pixel column, whatever the length
    expect(d.match(/[ML]/g)!.length).toBeLessThanOrEqual(2 * 200 + 4)
    // the spike survives the thinning and stays the top of the scale
    expect(d).toContain(' 0L')
    expect(wrapper.get('.dou-sparkline__marker').attributes('style')).toContain('top: 0%')
    expect(elapsed).toBeLessThan(500)
  })
})
