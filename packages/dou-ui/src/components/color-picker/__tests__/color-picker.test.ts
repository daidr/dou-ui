import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { DouColorPicker } from '../../../index'
import { COLOR_FORMATS, convert, formatColor, inSrgb, parseColor, toSrgb } from '../color'

afterEach(() => {
  document.body.innerHTML = ''
})

const hexOf = (text: string) => formatColor(parseColor(text)!, 'hex')

describe('color helpers', () => {
  it('reads hex', () => {
    expect(hexOf('#f80')).toBe('#ff8800')
    expect(hexOf('3f56b5')).toBe('#3f56b5')
    expect(formatColor(parseColor('#2e7d5bcc')!, 'hex')).toBe('#2e7d5bcc')
    expect(parseColor('nope')).toBeNull()
    expect(parseColor('rgb(1 2)')).toBeNull()
  })

  it('prints every format and reads it back', () => {
    for (const hex of ['#3f56b5', '#ffffff', '#000000', '#2e7d5b', '#a8572d', '#7a4fb5'])
      for (const format of COLOR_FORMATS)
        expect(hexOf(formatColor(parseColor(hex)!, format)), `${hex} as ${format}`).toBe(hex)
  })

  it('prints the CSS syntax, with alpha only when partly transparent', () => {
    const color = parseColor('#ff0000')!
    expect(formatColor(color, 'rgb')).toBe('rgb(255 0 0)')
    expect(formatColor(color, 'hsl')).toBe('hsl(0 100% 50%)')
    expect(formatColor(color, 'hwb')).toBe('hwb(0 0% 0%)')
    expect(formatColor(color, 'lab')).toBe('lab(54.29 80.8 69.89)')
    expect(formatColor(color, 'oklch')).toBe('oklch(0.628 0.2577 29.23)')
    const half = { ...color, alpha: 0.5 }
    expect(formatColor(half, 'rgb')).toBe('rgb(255 0 0 / 0.5)')
    expect(formatColor(half, 'hex')).toBe('#ff000080')
    expect(formatColor(half, 'rgb', { alpha: false })).toBe('rgb(255 0 0)')
  })

  it('reads the comma syntax, percentages, angle units and none', () => {
    expect(hexOf('rgba(63, 86, 181, 0.5)')).toBe('#3f56b580')
    expect(hexOf('rgb(100% 0% 0% / 50%)')).toBe('#ff000080')
    expect(hexOf('hsl(0.5turn 100% 50%)')).toBe('#00ffff')
    expect(hexOf('hsla(180deg, 100%, 50%, 1)')).toBe('#00ffff')
    expect(hexOf('hsv(120 100% 100%)')).toBe('#00ff00')
    expect(hexOf('oklch(62.8% 0.2577 29.23)')).toBe('#ff0000')
    expect(hexOf('oklch(1 0 none)')).toBe('#ffffff')
  })

  it('keeps the hue of a gray when converting', () => {
    const gray = parseColor('#808080')!
    expect(convert(gray, 'hsl', 200).coords[0]).toBe(200)
    expect(convert(gray, 'oklch', 120).coords[2]).toBe(120)
  })

  it('maps colors outside sRGB back in, or keeps them with gamut none', () => {
    const wide = parseColor('oklch(0.7 0.4 150)')!
    expect(inSrgb(wide)).toBe(false)
    const rgb = toSrgb(wide)
    expect(rgb.every((c) => c >= 0 && c <= 1)).toBe(true)
    const mapped = parseColor(formatColor(wide, 'oklch'))!
    expect(inSrgb(mapped)).toBe(true)
    // the lightness and hue stay close; only the chroma gives way
    expect(Math.abs(mapped.coords[0] - 0.7)).toBeLessThan(0.02)
    expect(mapped.coords[1]).toBeLessThan(0.25)
    expect(formatColor(wide, 'oklch', { gamut: 'none' })).toBe('oklch(0.7 0.4 150)')
    // hex can only hold sRGB
    expect(formatColor(wide, 'hex', { gamut: 'none' })).toBe(formatColor(wide, 'hex'))
  })
})

const sliders = () => [...document.querySelectorAll<HTMLElement>('[role="slider"]')]
const key = (el: HTMLElement, init: KeyboardEventInit) =>
  el.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, ...init }))

function mountPicker(props: Record<string, unknown>) {
  const wrapper = mount(DouColorPicker, {
    props: {
      ...props,
      'onUpdate:modelValue': (v: unknown) => wrapper.setProps({ modelValue: v as string | null }),
    },
    attachTo: document.body,
  })
  return wrapper
}

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
    expect(sliders().map((el) => el.getAttribute('aria-label'))).toEqual(['饱和度与明度', '色相'])
    wrapper.unmount()
  })

  it('moves the hue with the keyboard and reports a change on close', async () => {
    const wrapper = mountPicker({ modelValue: '#ff0000' })
    await wrapper.get('.dou-color-picker').trigger('click')
    const hue = sliders()[1]!
    key(hue, { key: 'ArrowRight', shiftKey: true })
    await nextTick()
    expect(hue.getAttribute('aria-valuenow')).toBe('36')
    expect(wrapper.props('modelValue')).toBe('#ff9900')
    expect(wrapper.emitted('change')).toBeUndefined()
    await wrapper.get('.dou-color-picker').trigger('click')
    expect(wrapper.emitted('change')).toEqual([['#ff9900']])
    wrapper.unmount()
  })

  it('takes a typed value and a preset, with alpha', async () => {
    const wrapper = mountPicker({ modelValue: null, showAlpha: true, presets: ['rgb(46 125 91)'] })
    await wrapper.get('.dou-color-picker').trigger('click')
    expect(sliders()).toHaveLength(3)
    const text = document.querySelector<HTMLInputElement>('.dou-color-picker__text')!
    text.value = '#11223380'
    text.dispatchEvent(new Event('input'))
    text.dispatchEvent(new Event('change'))
    await nextTick()
    expect(wrapper.props('modelValue')).toBe('#11223380')
    document.querySelector<HTMLElement>('.dou-color-picker__preset')!.click()
    await nextTick()
    expect(wrapper.props('modelValue')).toBe('#2e7d5b')
    expect(document.querySelector('.dou-color-picker__preset')!.getAttribute('aria-pressed')).toBe(
      'true',
    )
    wrapper.unmount()
  })

  it('writes the value in the chosen format', async () => {
    const wrapper = mountPicker({ modelValue: '#ff0000', format: 'hsl' })
    expect(wrapper.text()).toContain('hsl(0 100% 50%)')
    await wrapper.get('.dou-color-picker').trigger('click')
    key(sliders()[1]!, { key: 'ArrowRight', shiftKey: true })
    await nextTick()
    expect(wrapper.props('modelValue')).toBe('hsl(36 100% 50%)')
    wrapper.unmount()
  })

  it('shows the text box in another format without changing the value format', async () => {
    const wrapper = mountPicker({ modelValue: '#ff0000' })
    await wrapper.get('.dou-color-picker').trigger('click')
    const select = document.querySelector<HTMLSelectElement>('.dou-color-picker__format')!
    select.value = 'rgb'
    select.dispatchEvent(new Event('change'))
    await nextTick()
    const text = document.querySelector<HTMLInputElement>('.dou-color-picker__text')!
    expect(text.value).toBe('255 0 0')
    // the arguments alone are read in the menu's format
    text.value = '0 0 255'
    text.dispatchEvent(new Event('input'))
    text.dispatchEvent(new Event('change'))
    await nextTick()
    expect(wrapper.props('modelValue')).toBe('#0000ff')
    wrapper.unmount()
  })

  it('picks with channel sliders and switches panels', async () => {
    const wrapper = mountPicker({
      modelValue: 'oklch(0.6 0.1 250)',
      format: 'oklch',
      panel: ['square', 'wheel', 'oklch'],
    })
    await wrapper.get('.dou-color-picker').trigger('click')
    const tabs = [...document.querySelectorAll<HTMLElement>('.dou-color-picker__tab')]
    expect(tabs.map((tab) => tab.textContent!.trim())).toEqual(['色板', '色轮', 'OKLCH'])
    tabs[2]!.click()
    await nextTick()
    expect(sliders().map((el) => el.getAttribute('aria-label'))).toEqual(['亮度', '彩度', '色相'])
    expect(sliders()[0]!.getAttribute('aria-valuenow')).toBe('0.6')
    key(sliders()[0]!, { key: 'ArrowUp', shiftKey: true })
    await nextTick()
    expect(wrapper.props('modelValue')).toBe('oklch(0.7 0.1 250)')
    const number = document.querySelectorAll<HTMLInputElement>('.dou-color-picker__number')[2]!
    number.value = '120'
    number.dispatchEvent(new Event('change'))
    await nextTick()
    expect(wrapper.props('modelValue')).toBe('oklch(0.7 0.1 120)')
    tabs[1]!.click()
    await nextTick()
    expect(sliders().map((el) => el.getAttribute('aria-label'))).toEqual(['色相与饱和度', '明度'])
    wrapper.unmount()
  })

  it('keeps an oklch chroma the gamut cuts while dragging', async () => {
    const wrapper = mountPicker({
      modelValue: 'oklch(0.7 0.1 150)',
      format: 'oklch',
      panel: 'oklch',
    })
    await wrapper.get('.dou-color-picker').trigger('click')
    const chroma = sliders()[1]!
    for (let i = 0; i < 3; i++) key(chroma, { key: 'ArrowRight', shiftKey: true })
    await nextTick()
    // 0.1 + 3 × 0.04 = 0.22, past what sRGB holds at this lightness and hue
    expect(chroma.getAttribute('aria-valuenow')).toBe('0.22')
    const value = parseColor(wrapper.props('modelValue') as string)!
    expect(inSrgb(value)).toBe(true)
    wrapper.unmount()
  })
})
