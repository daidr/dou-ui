import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { DouSwitch } from '../../../index'

const withModel = (props: Record<string, unknown> = {}) => {
  const wrapper = mount(DouSwitch, {
    props: {
      modelValue: false,
      'onUpdate:modelValue': (value: unknown) => wrapper.setProps({ modelValue: value as boolean }),
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

  it('works without v-model', async () => {
    const wrapper = mount(DouSwitch)
    await wrapper.get('button').trigger('click')
    expect(wrapper.get('button').attributes('aria-checked')).toBe('true')
  })

  it('uses checkedValue and uncheckedValue', async () => {
    const wrapper = withModel({ modelValue: 'off', checkedValue: 'on', uncheckedValue: 'off' })
    expect(wrapper.get('button').attributes('aria-checked')).toBe('false')
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['on'])
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['off'])
  })

  it('defaults to true and false when only one value is given', async () => {
    const wrapper = withModel({ modelValue: 0, uncheckedValue: 0 })
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([true])
  })

  it('waits on beforeChange and keeps the value when it says no', async () => {
    let settle!: (value: boolean) => void
    const beforeChange = vi.fn<(next: boolean) => Promise<boolean>>(
      () => new Promise<boolean>((resolve) => (settle = resolve)),
    )
    const wrapper = withModel({ beforeChange })
    await wrapper.get('button').trigger('click')
    expect(beforeChange).toHaveBeenCalledWith(true)
    expect(wrapper.get('button').attributes('aria-busy')).toBe('true')
    // presses while pending are ignored
    await wrapper.get('button').trigger('click')
    expect(beforeChange).toHaveBeenCalledTimes(1)
    settle(false)
    await flushPromises()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(wrapper.get('button').attributes('aria-busy')).toBeUndefined()

    await wrapper.get('button').trigger('click')
    settle(true)
    await flushPromises()
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([true])
  })

  it('treats a rejected beforeChange as no', async () => {
    const wrapper = withModel({ beforeChange: () => Promise.reject(new Error('offline')) })
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('stays focusable but unchanged when read-only', async () => {
    const wrapper = withModel({ readonly: true })
    const track = wrapper.get('button')
    expect(track.attributes('disabled')).toBeUndefined()
    expect(track.attributes('aria-readonly')).toBe('true')
    expect(wrapper.classes()).toContain('is-readonly')
    await track.trigger('click')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('marks itself invalid', () => {
    const wrapper = withModel({ invalid: true })
    expect(wrapper.get('button').attributes('aria-invalid')).toBe('true')
    expect(wrapper.classes()).toContain('is-invalid')
  })
})
