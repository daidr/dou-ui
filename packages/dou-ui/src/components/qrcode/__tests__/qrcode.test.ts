import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { DouQrcode } from '../../../index'
import { encodeQr } from '../encode'

/** The finder pattern every QR code has in three corners. */
function hasFinder(modules: boolean[][], x0: number, y0: number) {
  for (let y = 0; y < 7; y++) {
    for (let x = 0; x < 7; x++) {
      const ring = Math.max(Math.abs(x - 3), Math.abs(y - 3))
      if (modules[y0 + y]![x0 + x] !== (ring !== 2)) return false
    }
  }
  return true
}

describe('encodeQr', () => {
  it('picks the smallest version that fits', () => {
    expect(encodeQr('01234567', 'M').version).toBe(1)
    expect(encodeQr('HELLO WORLD', 'Q').version).toBe(1)
    const long = encodeQr('https://ui.daidr.me/components/qrcode?from=docs', 'M')
    expect(long.version).toBe(4)
    expect(long.size).toBe(33)
  })

  it('draws the finder patterns and the dark module', () => {
    const { modules, size, version } = encodeQr('你好，DouUI', 'H')
    expect(hasFinder(modules, 0, 0)).toBe(true)
    expect(hasFinder(modules, size - 7, 0)).toBe(true)
    expect(hasFinder(modules, 0, size - 7)).toBe(true)
    // Always dark, just above the bottom-left finder's separator.
    expect(modules[4 * version + 9]?.[8]).toBe(true)
  })

  it('raises the level when the version has room for it', () => {
    expect(encodeQr('1', 'L').level).toBe('H')
  })

  it('refuses text that does not fit', () => {
    expect(() => encodeQr('x'.repeat(3000), 'H')).toThrow(RangeError)
  })
})

describe('DouQrcode', () => {
  it('renders the code as one labelled image', () => {
    const wrapper = mount(DouQrcode, { props: { value: 'https://ui.daidr.me', size: 120 } })
    const svg = wrapper.get('svg')
    expect(svg.attributes('role')).toBe('img')
    expect(svg.attributes('aria-label')).toBe('二维码：https://ui.daidr.me')
    expect(svg.attributes('width')).toBe('120')
    // Version 2 (25 modules) and a quiet zone of 2 on each side.
    expect(svg.attributes('viewBox')).toBe('0 0 29 29')
    expect(wrapper.get('.dou-qrcode__modules').attributes('d')).toMatch(/^M/)
  })

  it('covers an expired code and asks for a new one', async () => {
    const wrapper = mount(DouQrcode, { props: { value: 'a', status: 'expired' } })
    expect(wrapper.classes()).toContain('is-expired')
    expect(wrapper.get('.dou-qrcode__expired').text()).toBe('二维码已过期')
    await wrapper.get('.dou-qrcode__refresh').trigger('click')
    expect(wrapper.emitted('refresh')).toHaveLength(1)

    await wrapper.setProps({ status: 'loading' })
    expect(wrapper.find('.dou-spinner').exists()).toBe(true)
  })

  it('uses the highest level under an icon', () => {
    const plain = mount(DouQrcode, { props: { value: 'https://ui.daidr.me' } })
    const withIcon = mount(DouQrcode, { props: { value: 'https://ui.daidr.me', icon: 'logo.png' } })
    expect(withIcon.find('.dou-qrcode__icon').attributes('alt')).toBe('')
    const modules = (wrapper: typeof plain) =>
      Number(wrapper.get('svg').attributes('viewBox')?.split(' ')[2])
    // Level H needs more room for the same text.
    expect(modules(withIcon)).toBeGreaterThan(modules(plain))
  })
})
