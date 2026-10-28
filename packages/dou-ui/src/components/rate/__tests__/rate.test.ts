import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { DouRate } from '../../../index'

const fills = (wrapper: ReturnType<typeof mount>) =>
  wrapper
    .findAll('.dou-rate__star')
    .map((star) => (star.element as HTMLElement).style.getPropertyValue('--dou-rate-fill'))

describe('DouRate', () => {
  it('exposes a slider with a readable value', () => {
    const wrapper = mount(DouRate, { props: { modelValue: 3 } })
    const slider = wrapper.get('[role="slider"]')
    expect(slider.attributes('aria-valuenow')).toBe('3')
    expect(slider.attributes('aria-valuemax')).toBe('5')
    expect(slider.attributes('aria-valuetext')).toBe('3 星，共 5 星')
    expect(fills(wrapper)).toEqual(['1', '1', '1', '0', '0'])
  })

  it('fills half a star', () => {
    const wrapper = mount(DouRate, { props: { modelValue: 2.5, allowHalf: true } })
    expect(fills(wrapper)).toEqual(['1', '1', '0.5', '0', '0'])
  })

  it('picks a score on click and clears it when allowed', async () => {
    const wrapper = mount(DouRate, { props: { modelValue: 0, clearable: true } })
    await wrapper.findAll('.dou-rate__star')[3]!.trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([[4]])
    await wrapper.setProps({ modelValue: 4 })
    await wrapper.findAll('.dou-rate__star')[3]!.trigger('click')
    expect(wrapper.emitted('update:modelValue')!.at(-1)).toEqual([0])
  })

  it('steps with the keyboard', async () => {
    const wrapper = mount(DouRate, { props: { modelValue: 2, allowHalf: true } })
    const slider = wrapper.get('[role="slider"]')
    await slider.trigger('keydown', { key: 'ArrowRight' })
    expect(wrapper.emitted('update:modelValue')!.at(-1)).toEqual([2.5])
    await slider.trigger('keydown', { key: 'End' })
    expect(wrapper.emitted('update:modelValue')!.at(-1)).toEqual([5])
    await slider.trigger('keydown', { key: '1' })
    expect(wrapper.emitted('update:modelValue')!.at(-1)).toEqual([1])
  })

  it('ignores input when readonly', async () => {
    const wrapper = mount(DouRate, { props: { modelValue: 2, readonly: true } })
    await wrapper.findAll('.dou-rate__star')[4]!.trigger('click')
    await wrapper.get('[role="slider"]').trigger('keydown', { key: 'ArrowRight' })
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(wrapper.get('[role="slider"]').attributes('aria-readonly')).toBe('true')
  })
})
