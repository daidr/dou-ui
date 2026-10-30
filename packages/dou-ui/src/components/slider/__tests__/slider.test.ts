import { mount } from '@vue/test-utils'
import { h, nextTick } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'
import { DouConfigProvider, DouForm, DouFormItem, DouSlider, en } from '../../../index'
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
  // A 200px wide rail starting at x = 0.
  const rail = wrapper.get('.dou-slider__rail').element as HTMLElement
  rail.getBoundingClientRect = () => ({ left: 0, width: 200 }) as DOMRect
  return { wrapper, rail: wrapper.get('.dou-slider__rail') }
}

describe('DouSlider', () => {
  it('renders a slider thumb with its value', () => {
    const { wrapper } = setup({ modelValue: 30 })
    const thumb = wrapper.get('[role="slider"]')
    expect(thumb.attributes('aria-valuenow')).toBe('30')
    expect(thumb.attributes('aria-valuemin')).toBe('0')
    expect(thumb.attributes('aria-valuemax')).toBe('100')
    expect(thumb.attributes('tabindex')).toBe('0')
    expect(thumb.attributes('style')).toContain('left: 30%')
    expect(wrapper.get('.dou-slider__fill').attributes('style')).toContain('width: 30%')
  })

  it('snaps to the step and stays within the bounds', () => {
    const { wrapper } = setup({ modelValue: 47, step: 10, min: 0, max: 50 })
    expect(wrapper.get('[role="slider"]').attributes('aria-valuenow')).toBe('50')
  })

  it('moves with the keyboard', async () => {
    const { wrapper } = setup({ modelValue: 50, step: 5 })
    const thumb = wrapper.get('[role="slider"]')
    await thumb.trigger('keydown', { key: 'ArrowRight' })
    expect(wrapper.props('modelValue')).toBe(55)
    await thumb.trigger('keydown', { key: 'PageDown' })
    expect(wrapper.props('modelValue')).toBe(45)
    await thumb.trigger('keydown', { key: 'End' })
    expect(wrapper.props('modelValue')).toBe(100)
    await thumb.trigger('keydown', { key: 'ArrowUp' })
    expect(wrapper.emitted('change')).toHaveLength(3)
  })

  it('jumps to a pressed spot and follows the drag', async () => {
    const { wrapper, rail } = setup({ modelValue: 0 })
    await rail.trigger('pointerdown', { button: 0, clientX: 50, pointerId: 1 })
    expect(wrapper.props('modelValue')).toBe(25)
    expect(wrapper.classes()).toContain('is-dragging')
    await rail.trigger('pointermove', { clientX: 150, pointerId: 1 })
    expect(wrapper.props('modelValue')).toBe(75)
    expect(wrapper.emitted('change')).toBeUndefined()
    await rail.trigger('pointerup', { pointerId: 1 })
    expect(wrapper.emitted('change')).toEqual([[75]])
    expect(document.activeElement).toBe(wrapper.get('[role="slider"]').element)
  })

  it('picks a range with two thumbs that do not pass each other', async () => {
    const { wrapper, rail } = setup({ range: true, modelValue: [20, 60] })
    const [start, end] = wrapper.findAll('[role="slider"]')
    expect(wrapper.attributes('role')).toBe('group')
    expect(start!.attributes('aria-label')).toBe('起始值')
    expect(end!.attributes('aria-label')).toBe('结束值')
    expect(start!.attributes('aria-valuemax')).toBe('60')
    expect(end!.attributes('aria-valuemin')).toBe('20')
    expect(wrapper.get('.dou-slider__fill').attributes('style')).toContain('left: 20%')

    // the press lands nearer the end thumb
    await rail.trigger('pointerdown', { button: 0, clientX: 160, pointerId: 1 })
    await rail.trigger('pointerup', { pointerId: 1 })
    expect(wrapper.props('modelValue')).toEqual([20, 80])

    await start!.trigger('keydown', { key: 'End' })
    expect(wrapper.props('modelValue')).toEqual([80, 80])
  })

  it('lets either of two stacked thumbs move away', async () => {
    const { wrapper, rail } = setup({ range: true, modelValue: [50, 50] })
    const thumbs = wrapper.findAll('[role="slider"]')
    await thumbs[1]!.trigger('pointerdown', { button: 0, clientX: 100, pointerId: 1 })
    await rail.trigger('pointermove', { clientX: 40, pointerId: 1 })
    await rail.trigger('pointerup', { pointerId: 1 })
    expect(wrapper.props('modelValue')).toEqual([20, 50])
  })

  it('reads range labels from the locale', () => {
    const wrapper = mount(DouConfigProvider, {
      props: { locale: en },
      slots: { default: () => h(DouSlider, { range: true }) },
    })
    expect(wrapper.findAll('[role="slider"]').map((t) => t.attributes('aria-label'))).toEqual([
      'Start',
      'End',
    ])
  })

  it('renders marks and describes values', () => {
    const { wrapper } = setup({
      modelValue: 50,
      marks: { 0: '0°C', 50: '50°C', 100: '100°C', 200: 'off the scale' },
      format: (value) => `${value}°C`,
    })
    const marks = wrapper.findAll('.dou-slider__mark')
    expect(marks.map((mark) => mark.text())).toEqual(['0°C', '50°C', '100°C'])
    expect(marks.map((mark) => mark.classes().includes('is-active'))).toEqual([true, true, false])
    expect(wrapper.get('[role="slider"]').attributes('aria-valuetext')).toBe('50°C')
    expect(wrapper.classes()).toContain('is-marked')
  })

  it('does nothing when disabled', async () => {
    const { wrapper, rail } = setup({ modelValue: 10, disabled: true })
    const thumb = wrapper.get('[role="slider"]')
    expect(thumb.attributes('tabindex')).toBe('-1')
    expect(thumb.attributes('aria-disabled')).toBe('true')
    await thumb.trigger('keydown', { key: 'ArrowRight' })
    await rail.trigger('pointerdown', { button: 0, clientX: 100, pointerId: 1 })
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('names the thumb with aria-label, or with the form item label', async () => {
    const { wrapper } = setup({ modelValue: 1 })
    wrapper.unmount()
    const labelled = mount(DouSlider, { attrs: { 'aria-label': '音量' } })
    expect(labelled.get('[role="slider"]').attributes('aria-label')).toBe('音量')
    expect(labelled.attributes('aria-label')).toBeUndefined()

    const form = mount(DouForm, {
      props: { size: 'lg' },
      slots: {
        default: () => h(DouFormItem, { label: '音量', help: '0 到 100' }, () => h(DouSlider)),
      },
    })
    await nextTick()
    const label = form.get('label')
    const thumb = form.get('[role="slider"]')
    expect(label.attributes('for')).toBeUndefined()
    expect(thumb.attributes('aria-labelledby')).toBe(label.attributes('id'))
    expect(thumb.attributes('aria-describedby')).toBeDefined()
    expect(form.get('.dou-slider').classes()).toContain('dou-slider--lg')
  })
})
