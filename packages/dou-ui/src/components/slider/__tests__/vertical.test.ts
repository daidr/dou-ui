import { mount } from '@vue/test-utils'
import { h, nextTick } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'
import { DouForm, DouFormItem, DouSlider } from '../../../index'
import type { SliderProps, SliderValue } from '../../../index'

afterEach(() => {
  document.body.innerHTML = ''
})

function setup(props: SliderProps = {}) {
  const wrapper = mount(DouSlider, {
    props: {
      ...props,
      'onUpdate:modelValue': (value: SliderValue | undefined) =>
        wrapper.setProps({ modelValue: value }),
    },
    attachTo: document.body,
  })
  const rail = wrapper.get('.dou-slider__rail').element as HTMLElement
  // A 200px tall rail from y = 0 to y = 200.
  rail.getBoundingClientRect = () =>
    ({ left: 0, top: 0, bottom: 200, width: 4, height: 200 }) as DOMRect
  return { wrapper, rail: wrapper.get('.dou-slider__rail') }
}

describe('DouSlider vertical', () => {
  it('places the thumb and fill from the bottom, sized by height', () => {
    const { wrapper } = setup({ modelValue: 30, vertical: true, height: 160 })
    expect(wrapper.classes()).toContain('is-vertical')
    expect(wrapper.attributes('style')).toContain('height: 160px')
    const thumb = wrapper.get('[role="slider"]')
    expect(thumb.attributes('aria-orientation')).toBe('vertical')
    expect(thumb.attributes('style')).toContain('bottom: 30%')
    expect(wrapper.get('.dou-slider__fill').attributes('style')).toContain('height: 30%')
  })

  it('reads the pointer from the bottom up', async () => {
    const { wrapper, rail } = setup({ modelValue: 0, vertical: true })
    await rail.trigger('pointerdown', { button: 0, clientX: 2, clientY: 50, pointerId: 1 })
    expect(wrapper.props('modelValue')).toBe(75)
    await rail.trigger('pointerup', { pointerId: 1 })
    expect(wrapper.emitted('change')).toEqual([[75]])
  })
})

describe('DouSlider showInput', () => {
  it('keeps a number input in sync with the thumb', async () => {
    const { wrapper } = setup({
      modelValue: 20,
      showInput: true,
      step: 5,
      'aria-label': '音量',
    } as SliderProps)
    const input = wrapper.get('.dou-slider__input input')
    expect((input.element as HTMLInputElement).value).toBe('20')
    expect(input.attributes('aria-label')).toBe('音量')
    await input.setValue('45')
    await input.trigger('change')
    await input.trigger('blur')
    await nextTick()
    expect(wrapper.props('modelValue')).toBe(45)
    expect(wrapper.emitted('change')!.at(-1)).toEqual([45])
    await wrapper.get('[role="slider"]').trigger('keydown', { key: 'ArrowRight' })
    expect((wrapper.get('.dou-slider__input input').element as HTMLInputElement).value).toBe('50')
  })

  it('is left out of a range slider, and does not take the form item’s id', () => {
    expect(
      setup({ range: true, showInput: true }).wrapper.find('.dou-slider__input').exists(),
    ).toBe(false)
    const wrapper = mount(() =>
      h(DouForm, null, () =>
        h(DouFormItem, { label: '音量' }, () => h(DouSlider, { modelValue: 10, showInput: true })),
      ),
    )
    const ids = wrapper.findAll('[id]').map((el) => el.attributes('id'))
    expect(new Set(ids).size).toBe(ids.length)
    expect(wrapper.get('[role="slider"]').attributes('id')).toBeTruthy()
  })
})
