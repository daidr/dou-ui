import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { DouProgress } from '../../../index'

describe('DouProgress', () => {
  it('reports its value to screen readers', () => {
    const wrapper = mount(DouProgress, { props: { value: 30, max: 60, showValue: true } })
    expect(wrapper.attributes('role')).toBe('progressbar')
    expect(wrapper.attributes('aria-valuenow')).toBe('30')
    expect(wrapper.attributes('aria-valuemax')).toBe('60')
    expect(wrapper.get('.dou-progress__bar').attributes('style')).toContain('translateX(-50%)')
    expect(wrapper.get('.dou-progress__value').text()).toBe('50%')
  })

  it('clamps the bar to the track', () => {
    const wrapper = mount(DouProgress, { props: { value: 140 } })
    expect(wrapper.get('.dou-progress__bar').attributes('style')).toContain('translateX(0%)')
  })

  it('is indeterminate without a value', () => {
    const wrapper = mount(DouProgress, { props: { label: '上传中', showValue: true } })
    expect(wrapper.classes()).toContain('is-indeterminate')
    expect(wrapper.attributes('aria-valuenow')).toBeUndefined()
    expect(wrapper.attributes('aria-label')).toBe('上传中')
    expect(wrapper.find('.dou-progress__value').exists()).toBe(false)
  })
})

const dash = (wrapper: ReturnType<typeof mount>, at: number) =>
  wrapper.findAll('circle')[at]!.attributes('stroke-dasharray')!.split(' ').map(Number)

describe('DouProgress rings', () => {
  it('draws a circle sized by width, filled to the percentage', () => {
    const wrapper = mount(DouProgress, {
      props: { type: 'circle', value: 25, width: 100, size: 'md', showValue: true },
    })
    expect(wrapper.classes()).toEqual(
      expect.arrayContaining(['dou-progress--ring', 'dou-progress--circle']),
    )
    expect(wrapper.attributes('style')).toContain('width: 100px')
    const [track, length] = dash(wrapper, 0)
    expect(track).toBeCloseTo(length!)
    expect(dash(wrapper, 1)[0]).toBeCloseTo(length! / 4)
    expect(wrapper.find('.dou-progress__value').text()).toBe('25%')
    expect(wrapper.find('circle').attributes('stroke-width')).toBe('6')
  })

  it('leaves a quarter open for a dashboard, and starts at its left end', () => {
    const wrapper = mount(DouProgress, {
      props: { type: 'dashboard', value: 100, strokeWidth: 10 },
    })
    const [track, length] = dash(wrapper, 0)
    expect(track).toBeCloseTo(length! * 0.75)
    expect(dash(wrapper, 1)[0]).toBeCloseTo(length! * 0.75)
    expect(wrapper.find('g').attributes('transform')).toBe('rotate(135 50 50)')
  })

  it('spins a short arc while the amount is unknown, and hides the bar at zero', () => {
    const spinning = mount(DouProgress, { props: { type: 'circle' } })
    expect(spinning.classes()).toContain('is-indeterminate')
    expect(spinning.find('[role="progressbar"]').attributes('aria-valuenow')).toBeUndefined()
    const empty = mount(DouProgress, { props: { type: 'circle', value: 0 } })
    expect(empty.classes()).toContain('is-empty')
  })
})
