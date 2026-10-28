import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { DouDivider } from '../../../index'

describe('DouDivider', () => {
  it('is a horizontal separator by default', () => {
    const wrapper = mount(DouDivider)
    expect(wrapper.attributes('role')).toBe('separator')
    expect(wrapper.attributes('aria-orientation')).toBe('horizontal')
    expect(wrapper.classes()).toContain('dou-divider--horizontal')
    expect(wrapper.find('.dou-divider__label').exists()).toBe(false)
  })

  it('renders a label with alignment', () => {
    const wrapper = mount(DouDivider, { props: { align: 'start' }, slots: { default: '或' } })
    expect(wrapper.classes()).toEqual(expect.arrayContaining(['is-labelled', 'dou-divider--start']))
    expect(wrapper.find('.dou-divider__label').text()).toBe('或')
  })

  it('ignores the label when vertical', () => {
    const wrapper = mount(DouDivider, {
      props: { direction: 'vertical' },
      slots: { default: '或' },
    })
    expect(wrapper.attributes('aria-orientation')).toBe('vertical')
    expect(wrapper.text()).toBe('')
  })

  it('can be dashed', () => {
    expect(mount(DouDivider, { props: { dashed: true } }).classes()).toContain('is-dashed')
  })
})
