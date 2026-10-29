import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { DouProgress } from '../../../index'

const tone = (wrapper: ReturnType<typeof mount>) =>
  (wrapper.element as HTMLElement).style.getPropertyValue('--dou-progress-tone')

describe('DouProgress text inside and colors', () => {
  it('puts the percentage inside the bar, or after it when too short', async () => {
    const wrapper = mount(DouProgress, { props: { value: 64, textInside: true, showValue: true } })
    expect(wrapper.classes()).toContain('is-text-inside')
    const inner = wrapper.get('.dou-progress__inner')
    expect(inner.text()).toBe('64%')
    expect(inner.attributes('style')).toContain('left: 64%')
    expect(inner.classes()).not.toContain('is-outside')
    expect(wrapper.find('.dou-progress__value').exists()).toBe(false)
    await wrapper.setProps({ value: 5 })
    expect(wrapper.get('.dou-progress__inner').classes()).toContain('is-outside')
  })

  it('takes a plain color, color stops or a function', async () => {
    const wrapper = mount(DouProgress, { props: { value: 20, color: '#7c3aed' } })
    expect(tone(wrapper)).toBe('#7c3aed')
    expect(wrapper.classes()).toContain('is-custom')

    const stops = [
      { percent: 100, color: 'green' },
      { percent: 30, color: 'red' },
      { percent: 70, color: 'orange' },
    ]
    await wrapper.setProps({ color: stops })
    expect(tone(wrapper)).toBe('red')
    await wrapper.setProps({ value: 50 })
    expect(tone(wrapper)).toBe('orange')
    await wrapper.setProps({ value: 100 })
    expect(tone(wrapper)).toBe('green')

    await wrapper.setProps({ color: (p: number) => (p > 90 ? 'blue' : 'gray') })
    expect(tone(wrapper)).toBe('blue')
  })

  it('colors rings too', () => {
    const wrapper = mount(DouProgress, { props: { value: 40, type: 'circle', color: 'teal' } })
    expect(tone(wrapper)).toBe('teal')
    expect(wrapper.find('.dou-progress__inner').exists()).toBe(false)
  })
})
