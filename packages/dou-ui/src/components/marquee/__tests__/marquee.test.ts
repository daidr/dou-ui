import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import { DouConfigProvider, DouMarquee } from '../../../index'

afterEach(() => vi.restoreAllMocks())

function sizes(content: number, box: number) {
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(content)
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(box)
}

describe('DouMarquee', () => {
  it('repeats the content enough to fill the loop, hidden from screen readers', async () => {
    sizes(200, 600)
    const wrapper = mount(DouMarquee, { props: { gap: 40 }, slots: { default: '公告' } })
    await nextTick()
    const copies = wrapper.findAll('.dou-marquee__content')
    // (600 + 40) / 240 rounds up to 3 copies after the real one
    expect(copies).toHaveLength(4)
    expect(copies[0]!.attributes('aria-hidden')).toBeUndefined()
    expect(copies.slice(1).every((copy) => copy.attributes('aria-hidden') === 'true')).toBe(true)
    expect(copies[1]!.attributes()).toHaveProperty('inert')
    expect(wrapper.classes()).toContain('is-ready')
    const style = wrapper.attributes('style')
    expect(style).toContain('--dou-marquee-distance: 240px')
    expect(style).toContain('--dou-marquee-duration: 6s')
  })

  it('reflects its options as classes', async () => {
    sizes(100, 100)
    const wrapper = mount(DouMarquee, {
      props: {
        direction: 'vertical',
        reverse: true,
        paused: true,
        fade: false,
        pauseOnHover: false,
      },
      slots: { default: 'x' },
    })
    await nextTick()
    expect(wrapper.classes()).toEqual(
      expect.arrayContaining(['dou-marquee--vertical', 'is-reverse', 'is-paused']),
    )
    expect(wrapper.classes()).not.toContain('is-fade')
    expect(wrapper.classes()).not.toContain('is-pausable')
  })

  it('holds still and shows the content once with reduced motion', async () => {
    sizes(200, 600)
    const wrapper = mount(() =>
      h(DouConfigProvider, { motion: 'reduce' }, () => h(DouMarquee, null, () => '公告')),
    )
    await nextTick()
    const marquee = wrapper.get('.dou-marquee')
    expect(marquee.classes()).toContain('is-still')
    expect(marquee.classes()).not.toContain('is-ready')
    expect(wrapper.findAll('.dou-marquee__content')).toHaveLength(1)
  })
})
