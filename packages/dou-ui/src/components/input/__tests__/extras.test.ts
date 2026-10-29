import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { DouInput } from '../../../index'

describe('DouInput extras', () => {
  it('reveals a password and hides it again', async () => {
    const wrapper = mount(DouInput, { props: { type: 'password', showPassword: true } })
    const toggle = wrapper.get('.dou-input__reveal')
    expect(wrapper.get('input').attributes('type')).toBe('password')
    expect(toggle.attributes('aria-pressed')).toBe('false')
    await toggle.trigger('click')
    expect(wrapper.get('input').attributes('type')).toBe('text')
    expect(toggle.attributes('aria-pressed')).toBe('true')
    await toggle.trigger('click')
    expect(wrapper.get('input').attributes('type')).toBe('password')
  })

  it('leaves the toggle out of other types', () => {
    const wrapper = mount(DouInput, { props: { showPassword: true } })
    expect(wrapper.find('.dou-input__reveal').exists()).toBe(false)
  })

  it('counts characters against maxlength', async () => {
    const wrapper = mount(DouInput, {
      props: { modelValue: '上海', showCount: true },
      attrs: { maxlength: 10 },
    })
    expect(wrapper.get('.dou-input__count').text()).toBe('2 / 10')
    await wrapper.setProps({ modelValue: '上海👍' })
    expect(wrapper.get('.dou-input__count').text()).toBe('3 / 10')
  })

  it('counts without a limit', () => {
    const wrapper = mount(DouInput, { props: { modelValue: 'abc', showCount: true } })
    expect(wrapper.get('.dou-input__count').text()).toBe('3')
  })
})
