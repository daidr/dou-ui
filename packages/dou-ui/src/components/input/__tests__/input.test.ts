import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { DouInput } from '../../../index'

describe('DouInput', () => {
  it('renders a text field with defaults', () => {
    const wrapper = mount(DouInput)
    expect(wrapper.classes()).toEqual(expect.arrayContaining(['dou-input', 'dou-input--md']))
    const input = wrapper.get('input')
    expect(input.attributes('type')).toBe('text')
    expect(input.element.value).toBe('')
  })

  it('works with v-model', async () => {
    const wrapper = mount(DouInput, {
      props: {
        modelValue: 'a',
        'onUpdate:modelValue': (value: string) => wrapper.setProps({ modelValue: value }),
      },
    })
    const input = wrapper.get('input')
    expect(input.element.value).toBe('a')
    await input.setValue('abc')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['abc'])
    expect(wrapper.props('modelValue')).toBe('abc')
  })

  it('forwards attributes to the native input and dresses the field with class', () => {
    const wrapper = mount(DouInput, {
      attrs: { placeholder: '搜索', name: 'q', class: 'extra', style: 'width: 200px' },
    })
    const input = wrapper.get('input')
    expect(input.attributes('placeholder')).toBe('搜索')
    expect(input.attributes('name')).toBe('q')
    expect(input.classes()).not.toContain('extra')
    expect(wrapper.classes()).toContain('extra')
    expect(wrapper.attributes('style')).toContain('width: 200px')
  })

  it('reflects disabled, readonly and invalid', () => {
    const wrapper = mount(DouInput, { props: { disabled: true, readonly: true, invalid: true } })
    const input = wrapper.get('input')
    expect(input.attributes('disabled')).toBeDefined()
    expect(input.attributes('readonly')).toBeDefined()
    expect(input.attributes('aria-invalid')).toBe('true')
    expect(wrapper.classes()).toEqual(
      expect.arrayContaining(['is-disabled', 'is-readonly', 'is-invalid']),
    )
  })

  it('clears the value only when there is one', async () => {
    const wrapper = mount(DouInput, { props: { clearable: true, modelValue: '' } })
    expect(wrapper.find('.dou-input__clear').exists()).toBe(false)
    await wrapper.setProps({ modelValue: 'hello' })
    await wrapper.get('.dou-input__clear').trigger('click')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([''])
    expect(wrapper.emitted('clear')).toHaveLength(1)
  })

  it('hides the clear button when the field cannot be edited', () => {
    const wrapper = mount(DouInput, {
      props: { clearable: true, modelValue: 'x', disabled: true },
    })
    expect(wrapper.find('.dou-input__clear').exists()).toBe(false)
  })

  it('renders prefix and suffix', () => {
    const wrapper = mount(DouInput, { slots: { prefix: '¥', suffix: '元' } })
    expect(wrapper.get('.dou-input__prefix').text()).toBe('¥')
    expect(wrapper.get('.dou-input__suffix').text()).toBe('元')
  })

  it('exposes focus helpers', () => {
    const wrapper = mount(DouInput, { attachTo: document.body })
    wrapper.vm.focus()
    expect(document.activeElement).toBe(wrapper.vm.input)
    wrapper.unmount()
  })
})
