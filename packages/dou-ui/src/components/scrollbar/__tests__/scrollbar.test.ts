import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { describe, expect, it } from 'vitest'
import { DouScrollbar } from '../../../index'

/** Give the scrolling element sizes, since the test DOM does no layout. */
function size(element: HTMLElement, values: Record<string, number>) {
  for (const [name, value] of Object.entries(values)) {
    Object.defineProperty(element, name, { configurable: true, get: () => value })
  }
}

describe('DouScrollbar', () => {
  it('wraps the content and sets the given heights', () => {
    const wrapper = mount(DouScrollbar, {
      props: { height: 200 },
      slots: { default: () => '内容' },
    })
    expect(wrapper.classes()).toContain('dou-scrollbar')
    expect(wrapper.attributes('style')).toContain('height: 200px')
    expect(wrapper.find('.dou-scrollbar__view').text()).toBe('内容')
    expect(
      wrapper.findAll('.dou-scrollbar__bar').every((bar) => bar.attributes('aria-hidden')),
    ).toBe(true)

    const grow = mount(DouScrollbar, { props: { maxHeight: '50vh' } })
    expect(grow.find('.dou-scrollbar__wrap').attributes('style')).toContain('max-height: 50vh')
  })

  it('sizes and places the thumb from the scroll position', async () => {
    const wrapper = mount(DouScrollbar, { props: { height: 100 }, attachTo: document.body })
    const wrap = wrapper.find('.dou-scrollbar__wrap').element as HTMLElement
    const bar = wrapper.find('.dou-scrollbar__bar.is-vertical').element as HTMLElement
    size(wrap, { clientHeight: 100, scrollHeight: 400, clientWidth: 100, scrollWidth: 100 })
    size(bar, { clientHeight: 100 })
    wrap.scrollTop = 150
    ;(wrapper.vm as unknown as { update: () => void }).update()
    await nextTick()

    const thumb = bar.querySelector<HTMLElement>('.dou-scrollbar__thumb')!
    expect(thumb.style.height).toBe('25px')
    // 150 of 300 scrolled moves the thumb halfway along the 75px it can travel.
    expect(thumb.style.transform).toBe('translateY(38px)')
    expect(bar.classList).toContain('is-active')
    expect(wrapper.find('.dou-scrollbar__bar.is-horizontal').classes()).not.toContain('is-active')
    // A scrollable area can be reached with the keyboard.
    expect(wrap.getAttribute('tabindex')).toBe('0')
    wrapper.unmount()
  })

  it('reports scrolling and marks itself while it scrolls', async () => {
    const wrapper = mount(DouScrollbar, { props: { height: 100 } })
    const wrap = wrapper.find('.dou-scrollbar__wrap')
    ;(wrap.element as HTMLElement).scrollTop = 30
    await wrap.trigger('scroll')
    expect(wrapper.emitted('scroll')?.[0]).toEqual([{ scrollTop: 30, scrollLeft: 0 }])
    expect(wrapper.classes()).toContain('is-scrolling')
  })

  it('keeps the bars visible with always', () => {
    const wrapper = mount(DouScrollbar, { props: { always: true } })
    expect(wrapper.classes()).toContain('is-always')
  })
})
