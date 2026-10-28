import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { DouSwitch } from '../../../index'

const withModel = (props: Record<string, unknown> = {}) => {
  const wrapper = mount(DouSwitch, {
    props: {
      modelValue: false,
      'onUpdate:modelValue': (value: boolean) => wrapper.setProps({ modelValue: value }),
      ...props,
    },
    slots: { default: '通知' },
  })
  return wrapper
}

describe('DouSwitch', () => {
  it('is a labelled switch button', () => {
    const wrapper = withModel()
    const track = wrapper.get('button')
    expect(track.attributes('role')).toBe('switch')
    expect(track.attributes('type')).toBe('button')
    expect(track.attributes('aria-checked')).toBe('false')
    const label = wrapper.get('.dou-switch__label')
    expect(track.attributes('aria-labelledby')).toBe(label.attributes('id'))
    expect(wrapper.classes()).toEqual(expect.arrayContaining(['dou-switch', 'dou-switch--md']))
  })

  it('toggles from the track and from the label', async () => {
    const wrapper = withModel()
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([true])
    expect(wrapper.get('button').attributes('aria-checked')).toBe('true')
    expect(wrapper.classes()).toContain('is-checked')
    await wrapper.get('.dou-switch__label').trigger('click')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([false])
  })

  it('ignores presses when disabled', async () => {
    const wrapper = withModel({ disabled: true })
    expect(wrapper.get('button').attributes('disabled')).toBeDefined()
    await wrapper.get('.dou-switch__label').trigger('click')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('stays focusable but inert while loading', async () => {
    const wrapper = withModel({ loading: true })
    const track = wrapper.get('button')
    expect(track.attributes('disabled')).toBeUndefined()
    expect(track.attributes('aria-busy')).toBe('true')
    expect(wrapper.find('.dou-switch__spinner').exists()).toBe(true)
    await track.trigger('click')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })
})
