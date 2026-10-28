import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { DouColorPicker } from '../../../index'
import { parseHex, toHex } from '../color'

afterEach(() => {
  document.body.innerHTML = ''
})

describe('color helpers', () => {
  it('round-trips hex through HSV', () => {
    for (const hex of ['#3f56b5', '#ffffff', '#000000', '#2e7d5b'])
      expect(toHex(parseHex(hex)!, false)).toBe(hex)
    expect(toHex(parseHex('#f80')!, false)).toBe('#ff8800')
    expect(toHex(parseHex('#2e7d5bcc')!, true)).toBe('#2e7d5bcc')
    expect(parseHex('nope')).toBeNull()
  })
})

describe('DouColorPicker', () => {
  it('shows the value and opens a dialog', async () => {
    const wrapper = mount(DouColorPicker, {
      props: { modelValue: '#3f56b5' },
      attachTo: document.body,
    })
    expect(wrapper.get('.dou-color-picker').attributes('role')).toBe('button')
    expect(wrapper.get('.dou-color-picker').attributes('aria-haspopup')).toBe('dialog')
    expect(wrapper.text()).toContain('#3f56b5')
    await wrapper.get('.dou-color-picker').trigger('click')
    expect(wrapper.get('.dou-color-picker').attributes('aria-expanded')).toBe('true')
    const sliders = document.querySelectorAll('[role="slider"]')
    expect([...sliders].map((el) => el.getAttribute('aria-label'))).toEqual([
      '饱和度与亮度',
      '色相',
    ])
    wrapper.unmount()
  })

  it('moves the hue with the keyboard and reports a change on close', async () => {
    const wrapper = mount(DouColorPicker, {
      props: {
        modelValue: '#ff0000',
        'onUpdate:modelValue': (v: unknown) => wrapper.setProps({ modelValue: v as string | null }),
      },
      attachTo: document.body,
    })
    await wrapper.get('.dou-color-picker').trigger('click')
    const hue = document.querySelectorAll<HTMLElement>('[role="slider"]')[1]!
    hue.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', shiftKey: true, bubbles: true }),
    )
    await nextTick()
    expect(hue.getAttribute('aria-valuenow')).toBe('36')
    expect(wrapper.props('modelValue')).toBe('#ff9900')
    expect(wrapper.emitted('change')).toBeUndefined()
    await wrapper.get('.dou-color-picker').trigger('click')
    expect(wrapper.emitted('change')).toEqual([['#ff9900']])
    wrapper.unmount()
  })

  it('takes a typed hex and a preset, with alpha', async () => {
    const wrapper = mount(DouColorPicker, {
      props: {
        modelValue: null,
        showAlpha: true,
        presets: ['#2e7d5b'],
        'onUpdate:modelValue': (v: unknown) => wrapper.setProps({ modelValue: v as string | null }),
      },
      attachTo: document.body,
    })
    await wrapper.get('.dou-color-picker').trigger('click')
    expect(document.querySelectorAll('[role="slider"]')).toHaveLength(3)
    const text = document.querySelector<HTMLInputElement>('.dou-color-picker__text')!
    text.value = '#11223380'
    text.dispatchEvent(new Event('input'))
    text.dispatchEvent(new Event('change'))
    await nextTick()
    expect(wrapper.props('modelValue')).toBe('#11223380')
    document.querySelector<HTMLElement>('.dou-color-picker__preset')!.click()
    await nextTick()
    expect(wrapper.props('modelValue')).toBe('#2e7d5b')
    wrapper.unmount()
  })
})
