import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { DouInputOtp } from '../../../index'

function make(props: Record<string, unknown> = {}) {
  const wrapper = mount(DouInputOtp, {
    props: {
      modelValue: '',
      'onUpdate:modelValue': (value: string) => wrapper.setProps({ modelValue: value }),
      ...props,
    },
    attachTo: document.body,
  })
  return wrapper
}

const cells = (wrapper: ReturnType<typeof make>) =>
  wrapper.findAll('.dou-input-otp__cell').map((cell) => cell.text())

describe('DouInputOtp', () => {
  it('is one labelled field for a one-time code', () => {
    const wrapper = make()
    const input = wrapper.get('input')
    expect(input.attributes('autocomplete')).toBe('one-time-code')
    expect(input.attributes('inputmode')).toBe('numeric')
    expect(input.attributes('maxlength')).toBe('6')
    expect(input.attributes('aria-label')).toBe('验证码')
    expect(wrapper.find('.dou-input-otp__cells').attributes('aria-hidden')).toBe('true')
    expect(cells(wrapper)).toHaveLength(6)
    wrapper.unmount()
  })

  it('keeps only what the type accepts and fills the cells', async () => {
    const wrapper = make({ length: 4 })
    await wrapper.get('input').setValue('1a2-3')
    expect(wrapper.props('modelValue')).toBe('123')
    expect(cells(wrapper)).toEqual(['1', '2', '3', ''])
    wrapper.unmount()
  })

  it('emits complete once every cell is filled, e.g. from a paste', async () => {
    const wrapper = make()
    await wrapper.get('input').setValue('482 913 77')
    expect(wrapper.props('modelValue')).toBe('482913')
    expect(wrapper.emitted('complete')).toEqual([['482913']])
    wrapper.unmount()
  })

  it('marks the cell that typing goes into', async () => {
    const wrapper = make({ modelValue: '12' })
    await wrapper.get('input').trigger('focus')
    const active = wrapper
      .findAll('.dou-input-otp__cell')
      .findIndex((cell) => cell.classes().includes('is-active'))
    expect(active).toBe(2)
    expect(wrapper.findAll('.dou-input-otp__cell')[2]!.find('.dou-input-otp__caret').exists()).toBe(
      true,
    )
    wrapper.unmount()
  })

  it('takes letters, masks and groups the cells', async () => {
    const wrapper = make({ type: 'alphanumeric', mask: true, separator: 3 })
    const input = wrapper.get('input')
    expect(input.attributes('type')).toBe('password')
    await input.setValue('ab12cd')
    expect(wrapper.props('modelValue')).toBe('ab12cd')
    expect(wrapper.findAll('.dou-input-otp__dot')).toHaveLength(6)
    expect(wrapper.findAll('.dou-input-otp__separator')).toHaveLength(1)
    wrapper.unmount()
  })
})
