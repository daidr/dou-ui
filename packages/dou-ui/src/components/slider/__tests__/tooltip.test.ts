import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { DouSlider } from '../../../index'

describe('DouSlider tooltip', () => {
  it('puts the formatted value over each thumb', () => {
    const wrapper = mount(DouSlider, {
      props: {
        modelValue: [20, 60],
        range: true,
        tooltip: true,
        formatValue: (v: number) => `${v}%`,
      },
    })
    const bubbles = wrapper.findAll('.dou-slider__tooltip')
    expect(bubbles.map((b) => b.text())).toEqual(['20%', '60%'])
    expect(bubbles[0]!.attributes('aria-hidden')).toBe('true')
    expect(wrapper.find('.dou-slider__thumb.is-pinned').exists()).toBe(false)
  })

  it('pins the bubble with `always`, and has none by default', async () => {
    const wrapper = mount(DouSlider, { props: { modelValue: 3 } })
    expect(wrapper.find('.dou-slider__tooltip').exists()).toBe(false)
    await wrapper.setProps({ tooltip: 'always' })
    expect(wrapper.get('.dou-slider__thumb').classes()).toContain('is-pinned')
    expect(wrapper.get('.dou-slider__tooltip').text()).toBe('3')
  })
})
