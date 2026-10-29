import { mount } from '@vue/test-utils'
import { h } from 'vue'
import { describe, expect, it } from 'vitest'
import { DouButton, DouFieldGroup, DouFieldGroupText, DouInput } from '../../../index'

describe('DouFieldGroup', () => {
  it('groups controls and hands them its size', () => {
    const wrapper = mount(DouFieldGroup, {
      props: { size: 'sm', block: true },
      slots: {
        default: () => [
          h(DouFieldGroupText, null, () => 'https://'),
          h(DouInput),
          h(DouButton, null, () => '访问'),
        ],
      },
    })
    expect(wrapper.attributes('role')).toBe('group')
    expect(wrapper.classes()).toEqual(
      expect.arrayContaining(['dou-field-group--horizontal', 'is-block']),
    )
    expect(wrapper.get('.dou-field-group-text').classes()).toContain('dou-field-group-text--sm')
    expect(wrapper.get('.dou-input').classes()).toContain('dou-input--sm')
    expect(wrapper.get('.dou-button').classes()).toContain('dou-button--sm')
  })

  it('lets a control keep its own size, and stacks vertically', () => {
    const wrapper = mount(DouFieldGroup, {
      props: { size: 'sm', orientation: 'vertical' },
      slots: { default: () => [h(DouButton, { size: 'lg' }, () => '上'), h(DouButton)] },
    })
    expect(wrapper.attributes('aria-orientation')).toBe('vertical')
    const [first, second] = wrapper.findAll('.dou-button')
    expect(first!.classes()).toContain('dou-button--lg')
    expect(second!.classes()).toContain('dou-button--sm')
  })
})
