import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { DouColorPanel } from '../../../index'

describe('DouColorPanel', () => {
  it('renders in place with a border, and edits the value', async () => {
    const wrapper = mount(DouColorPanel, {
      props: {
        modelValue: '#3366ff',
        presets: ['#ff0000'],
      },
      attachTo: document.body,
    })
    expect(wrapper.classes()).toEqual(expect.arrayContaining(['dou-color-panel', 'is-bordered']))
    expect(wrapper.get('.dou-color-panel__area').attributes('role')).toBe('slider')

    await wrapper.get('.dou-color-panel__preset').trigger('click')
    expect(wrapper.emitted('update:modelValue')!.at(-1)).toEqual(['#ff0000'])
    expect(wrapper.emitted('change')).toEqual([['#ff0000']])

    const text = wrapper.get('.dou-color-panel__text input')
    await text.setValue('00ff00')
    await text.trigger('change')
    expect(wrapper.emitted('update:modelValue')!.at(-1)).toEqual(['#00ff00'])

    await wrapper.get('.dou-color-panel__area').trigger('keydown', { key: 'ArrowLeft' })
    expect(wrapper.emitted('change')).toHaveLength(3)
    wrapper.unmount()
  })

  it('can hide the text box, and turns inert while disabled', () => {
    const wrapper = mount(DouColorPanel, {
      props: { modelValue: '#000', showInput: false, bordered: false, disabled: true },
    })
    expect(wrapper.find('.dou-color-panel__entry').exists()).toBe(false)
    expect(wrapper.classes()).not.toContain('is-bordered')
    expect(wrapper.attributes('inert')).toBeDefined()
    expect(wrapper.attributes('aria-disabled')).toBe('true')
  })
})
