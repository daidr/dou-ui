import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref, withDirectives } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DouInfiniteScroll, vInfiniteScroll } from '../../../index'

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

const noop = () => {}

/** Make an element report a scroll position: content `height` tall in a `view`-tall box. */
function fakeScroll(el: HTMLElement, sizes: { height: () => number; view: number }) {
  el.style.overflowY = 'auto'
  Object.defineProperty(el, 'scrollHeight', { configurable: true, get: sizes.height })
  Object.defineProperty(el, 'clientHeight', { configurable: true, value: sizes.view })
}

describe('v-infinite-scroll', () => {
  it('loads when the scrolling element nears its end, one load at a time', async () => {
    const rows = ref(10)
    let resolve: () => void = noop
    const load = vi.fn<() => Promise<void>>(() => new Promise<void>((done) => (resolve = done)))
    const List = defineComponent({
      setup: () => () =>
        withDirectives(
          h(
            'ul',
            {
              ref: (el) =>
                el && fakeScroll(el as HTMLElement, { height: () => rows.value * 40, view: 200 }),
            },
            Array.from({ length: rows.value }, (_, i) => h('li', i)),
          ),
          [[vInfiniteScroll, { load, immediate: false }]],
        ),
    })
    const wrapper = mount(List, { attachTo: document.body })
    const ul = wrapper.get('ul').element as HTMLElement

    ul.scrollTop = 0
    ul.dispatchEvent(new Event('scroll'))
    expect(load).not.toHaveBeenCalled()

    ul.scrollTop = 150 // 400 - 150 - 200 = 50 left, within 100
    ul.dispatchEvent(new Event('scroll'))
    ul.dispatchEvent(new Event('scroll'))
    expect(load).toHaveBeenCalledTimes(1)

    rows.value = 20
    resolve()
    await flushPromises()
    await nextTick()
    // The list grew past the end, so no second load until scrolled again.
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('stays quiet while disabled', async () => {
    const load = vi.fn<() => void>()
    const disabled = ref(true)
    const List = defineComponent({
      setup: () => () =>
        withDirectives(
          h('div', {
            ref: (el) => el && fakeScroll(el as HTMLElement, { height: () => 100, view: 200 }),
          }),
          [[vInfiniteScroll, { load, disabled: disabled.value }]],
        ),
    })
    mount(List, { attachTo: document.body })
    await flushPromises()
    expect(load).not.toHaveBeenCalled()
    disabled.value = false
    await flushPromises()
    expect(load).toHaveBeenCalledTimes(1)
  })
})

/** Place the component's end `below` px under the bottom of the window. */
function place(el: Element, below: () => number) {
  vi.spyOn(el, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList)
  vi.spyOn(el, 'getBoundingClientRect').mockImplementation(
    () => ({ bottom: window.innerHeight + below() }) as DOMRect,
  )
}

describe('DouInfiniteScroll', () => {
  it('loads on mount and on scroll, and says when it is loading and done', async () => {
    let resolve: () => void = noop
    const load = vi.fn<() => Promise<void>>(() => new Promise<void>((done) => (resolve = done)))
    let below = 0
    const wrapper = mount(DouInfiniteScroll, {
      props: { load, immediate: false },
      slots: { default: () => h('ul', [h('li', 'a')]) },
      attachTo: document.body,
    })
    place(wrapper.element, () => below)
    wrapper.vm.check()
    await nextTick()
    expect(load).toHaveBeenCalledTimes(1)
    expect(wrapper.attributes('aria-busy')).toBe('true')
    expect(wrapper.get('.dou-infinite-scroll__footer').text()).toBe('加载中')
    expect(wrapper.get('.dou-infinite-scroll__footer').attributes('role')).toBe('status')

    below = 500
    resolve()
    await flushPromises()
    expect(wrapper.attributes('aria-busy')).toBeUndefined()
    expect(wrapper.get('.dou-infinite-scroll__footer').text()).toBe('')

    below = 50
    window.dispatchEvent(new Event('scroll'))
    expect(load).toHaveBeenCalledTimes(2)
    resolve()
    await wrapper.setProps({ finished: true })
    await flushPromises()
    expect(wrapper.get('.dou-infinite-scroll__footer').text()).toBe('没有更多了')
    window.dispatchEvent(new Event('scroll'))
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('offers to retry a failed load', async () => {
    const load = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(undefined)
    const wrapper = mount(DouInfiniteScroll, {
      props: { load, immediate: false },
      attachTo: document.body,
    })
    place(wrapper.element, () => 0)
    wrapper.vm.check()
    await flushPromises()
    expect(wrapper.get('.dou-infinite-scroll__footer').text()).toContain('加载失败')
    window.dispatchEvent(new Event('scroll'))
    expect(load).toHaveBeenCalledTimes(1)

    await wrapper.get('.dou-infinite-scroll__retry').trigger('click')
    await flushPromises()
    expect(load).toHaveBeenCalledTimes(2)
    expect(wrapper.find('.dou-infinite-scroll__retry').exists()).toBe(false)
  })
})
