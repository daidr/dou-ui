import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { DouStatusDot } from '../../../index'

describe('DouStatusDot', () => {
  it('renders a neutral medium dot without a ripple by default', () => {
    const wrapper = mount(DouStatusDot)
    expect(wrapper.classes()).toEqual(
      expect.arrayContaining(['dou-status-dot', 'dou-status-dot--neutral', 'dou-status-dot--md']),
    )
    expect(wrapper.classes()).not.toContain('is-ripple')
    expect(wrapper.find('.dou-status-dot__dot').exists()).toBe(true)
    expect(wrapper.find('.dou-status-dot__label').exists()).toBe(false)
  })

  it('takes a tone, a size and the ripple', () => {
    const wrapper = mount(DouStatusDot, { props: { tone: 'success', size: 'lg', ripple: true } })
    expect(wrapper.classes()).toEqual(
      expect.arrayContaining(['dou-status-dot--success', 'dou-status-dot--lg', 'is-ripple']),
    )
  })

  it('lets the text beside it speak for the dot', () => {
    const wrapper = mount(DouStatusDot, {
      props: { label: '忽略' },
      slots: { default: '运行中' },
    })
    expect(wrapper.get('.dou-status-dot__label').text()).toBe('运行中')
    expect(wrapper.get('.dou-status-dot__dot').attributes('aria-hidden')).toBe('true')
    expect(wrapper.attributes('aria-label')).toBeUndefined()
    expect(wrapper.attributes('aria-hidden')).toBeUndefined()
  })

  it('announces a bare dot only through its label', async () => {
    const wrapper = mount(DouStatusDot)
    expect(wrapper.attributes('aria-hidden')).toBe('true')
    await wrapper.setProps({ label: '在线' })
    expect(wrapper.attributes('role')).toBe('img')
    expect(wrapper.attributes('aria-label')).toBe('在线')
    expect(wrapper.attributes('aria-hidden')).toBeUndefined()
  })
})
