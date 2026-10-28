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
