import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import type { ComponentPublicInstance } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DouChatList, useTouchScroll } from '../../../index'
import type { ChatListExpose } from '../chat-list'

function sized(el: HTMLElement, scrollHeight: number, clientHeight = 100) {
  Object.defineProperty(el, 'scrollHeight', { configurable: true, get: () => scrollHeight })
  Object.defineProperty(el, 'clientHeight', { configurable: true, get: () => clientHeight })
}

function touchEvent(
  type: string,
  points: { clientX?: number; clientY: number; identifier?: number }[] = [],
) {
  const touches = points.map((point, index) => ({
    identifier: point.identifier ?? index,
    clientX: point.clientX ?? 200,
    clientY: point.clientY,
  }))
  return Object.assign(new Event(type, { bubbles: true }), { touches })
}

function createFakeResizeObserver() {
  const observers: {
    elements: Set<Element>
    callback: ResizeObserverCallback
  }[] = []
  class FakeResizeObserver {
    elements = new Set<Element>()
    constructor(public callback: ResizeObserverCallback) {
      observers.push(this)
    }
    observe(element: Element) {
      this.elements.add(element)
    }
    unobserve(element: Element) {
      this.elements.delete(element)
    }
    disconnect() {
      this.elements.clear()
    }
  }
  vi.stubGlobal('ResizeObserver', FakeResizeObserver)
  return {
    observers,
    fire(sizes?: Map<Element, number>, filter?: (target: Element) => boolean) {
      for (const observer of observers) {
        const entries = [...observer.elements]
          .filter((target) => !filter || filter(target))
          .map((target) => {
            const block = sizes?.get(target)
            return (block !== undefined
              ? { target, borderBoxSize: [{ inlineSize: 390, blockSize: block }] }
              : { target }) as unknown as ResizeObserverEntry
          })
        if (entries.length) observer.callback(entries, observer as unknown as ResizeObserver)
      }
    },
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
  document.body.innerHTML = ''
})

describe('DouChatList', () => {
  it('is a labelled log', () => {
    const wrapper = mount(DouChatList, { slots: { default: () => '消息' } })
    const viewport = wrapper.get('.dou-chat-list__viewport')
    expect(viewport.attributes('role')).toBe('log')
    expect(viewport.attributes('aria-label')).toBe('消息列表')
    expect(wrapper.get('.dou-chat-list__content').text()).toBe('消息')
  })

  it('shows the scroll button away from the bottom and goes back down', async () => {
    const wrapper = mount(DouChatList, { attachTo: document.body })
    const el = wrapper.get('.dou-chat-list__viewport').element as HTMLElement
    sized(el, 1000)
    el.scrollTop = 900
    await wrapper.get('.dou-chat-list__viewport').trigger('scroll')
    expect(wrapper.find('.dou-chat-list__scroll-button').exists()).toBe(false)

    el.scrollTop = 400
    await wrapper.get('.dou-chat-list__viewport').trigger('scroll')
    expect(wrapper.emitted('atBottomChange')).toEqual([[false]])
    const button = wrapper.get('.dou-chat-list__scroll-button')
    expect(button.attributes('aria-label')).toBe('回到底部')

    el.scrollTo = ((options: ScrollToOptions) => {
      el.scrollTop = options.top!
    }) as typeof el.scrollTo
    await button.trigger('click')
    expect(el.scrollTop).toBe(1000)
    wrapper.unmount()
  })

  it('reports reaching the top once per visit', async () => {
    const wrapper = mount(DouChatList)
    const viewport = wrapper.get('.dou-chat-list__viewport')
    const el = viewport.element as HTMLElement
    sized(el, 1000)
    el.scrollTop = 0
    await viewport.trigger('scroll')
    await viewport.trigger('scroll')
    expect(wrapper.emitted('topReached')).toHaveLength(1)
    el.scrollTop = 300
    await viewport.trigger('scroll')
    el.scrollTop = 0
    await viewport.trigger('scroll')
    expect(wrapper.emitted('topReached')).toHaveLength(2)
    await nextTick()
  })

  it('keeps following new content when the target is not in the list', async () => {
    let grow: (() => void) | undefined
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          grow = callback
        }
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    )
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const wrapper = mount(DouChatList, {
      slots: { default: '<p>一</p><p id="two">二</p>' },
      attachTo: document.body,
    })
    const el = wrapper.get('.dou-chat-list__viewport').element as HTMLElement
    const exposed = wrapper.vm as unknown as { scrollToMessage: (target: unknown) => void }
    sized(el, 1000)
    exposed.scrollToMessage(document.createElement('p'))
    // the ref of a message no longer shown: ignored like a key not found, without a warning
    exposed.scrollToMessage(null)
    exposed.scrollToMessage(undefined)
    // the value a function ref receives, as Vue types it, is accepted as is
    const fromRef: Element | ComponentPublicInstance | null = document.createElement('p')
    ;(exposed as ChatListExpose).scrollToMessage(fromRef)
    expect(warn).not.toHaveBeenCalled()
    exposed.scrollToMessage('m1')
    expect(warn).toHaveBeenCalledTimes(1)
    grow?.()
    expect(el.scrollTop).toBe(1000)
    // a message that is there: new content no longer pulls the reader down
    exposed.scrollToMessage(wrapper.get('#two').element)
    el.scrollTop = 200
    sized(el, 1400)
    grow?.()
    expect(el.scrollTop).toBe(200)
    wrapper.unmount()
    warn.mockRestore()
    vi.unstubAllGlobals()
  })

  it('scrolls a message into view by its element, and by its key with items', async () => {
    const wrapper = mount(DouChatList, {
      slots: { default: '<p>一</p><p id="two">二</p>' },
      attachTo: document.body,
    })
    const viewport = wrapper.get('.dou-chat-list__viewport').element as HTMLElement
    sized(viewport, 1000)
    const exposed = wrapper.vm as unknown as {
      scrollToMessage: (target: unknown, align?: string) => void
    }
    // an element from elsewhere is left alone
    viewport.scrollTop = 0
    exposed.scrollToMessage(document.createElement('p'))
    expect(viewport.scrollTop).toBe(0)
    // a component gives its root element
    exposed.scrollToMessage({ $el: wrapper.get('#two').element }, 'start')
    expect(viewport.scrollTop).toBeGreaterThanOrEqual(0)
    wrapper.unmount()

    const items = Array.from({ length: 50 }, (_, index) => ({ id: `m${index}` }))
    const scrollToIndex = vi.fn<(index: number, align?: string) => void>()
    const VirtualList = defineComponent({
      name: 'DouVirtualList',
      setup(_, { expose }) {
        expose({ scrollToIndex, el: () => null })
        return () => h('div')
      },
    })
    const list = mount(DouChatList, {
      props: { items, itemKey: 'id' },
      global: { stubs: { DouVirtualList: VirtualList } },
    })
    await nextTick()
    const scrollToMessage = (list.vm as unknown as { scrollToMessage: (key: string) => void })
      .scrollToMessage
    scrollToMessage('m30')
    scrollToMessage('nope')
    expect(scrollToIndex).toHaveBeenCalledTimes(1)
    expect(scrollToIndex).toHaveBeenCalledWith(30, 'center')
    list.unmount()
  })

  it('exposes bottomInset as a CSS variable and toggles the bottomFade class', async () => {
    const wrapper = mount(DouChatList)
    expect(wrapper.attributes('style')).toBeUndefined()
    expect(wrapper.classes()).not.toContain('is-bottom-fade')

    await wrapper.setProps({ bottomInset: 120, bottomFade: true })
    expect(wrapper.attributes('style')).toContain('--dou-chat-list-bottom-inset: 120px')
    expect(wrapper.classes()).toContain('is-bottom-fade')

    await wrapper.setProps({ bottomInset: '8rem' })
    expect(wrapper.attributes('style')).toContain('--dou-chat-list-bottom-inset: 8rem')
  })

  it('keeps following the bottom when bottomInset changes while at bottom', async () => {
    const wrapper = mount(DouChatList, { attachTo: document.body })
    const el = wrapper.get('.dou-chat-list__viewport').element as HTMLElement
    sized(el, 1000)
    el.scrollTop = 900
    await wrapper.get('.dou-chat-list__viewport').trigger('scroll')

    sized(el, 1140)
    await wrapper.setProps({ bottomInset: 140 })
    await nextTick()
    expect(el.scrollTop).toBe(1140)
    wrapper.unmount()
  })

  it('respects scroll-padding-block-end when scrolling to a message', () => {
    const wrapper = mount(DouChatList, {
      slots: { default: '<p id="one">一</p><p id="two">二</p>' },
      attachTo: document.body,
    })
    const viewport = wrapper.get('.dou-chat-list__viewport').element as HTMLElement
    const target = wrapper.get('#two').element as HTMLElement
    sized(viewport, 1000, 300)
    viewport.style.scrollPaddingBlockEnd = '100px'
    viewport.getBoundingClientRect = () =>
      ({ top: 0, bottom: 300, height: 300, left: 0, right: 400, width: 400 }) as DOMRect
    target.getBoundingClientRect = () =>
      ({ top: 400, bottom: 450, height: 50, left: 0, right: 400, width: 400 }) as DOMRect

    const exposed = wrapper.vm as unknown as ChatListExpose
    exposed.scrollToMessage(target, 'end')
    // visible height above the floating composer is 300 - 100 = 200
    expect(viewport.scrollTop).toBe(250)
    wrapper.unmount()
  })

  it('exits auto-scroll on small upward scroll steps inside threshold and resumes when scrolling back down', async () => {
    const ro = createFakeResizeObserver()
    const wrapper = mount(DouChatList, {
      props: { threshold: 24 },
      slots: { default: '<p>消息</p>' },
      attachTo: document.body,
    })
    const el = wrapper.get('.dou-chat-list__viewport').element as HTMLElement
    sized(el, 1000, 400)
    el.scrollTop = 600
    el.dispatchEvent(new Event('scroll'))

    // Scroll up by 5px (dist = 5 <= threshold 24): must immediately turn following off
    el.scrollTop = 595
    el.dispatchEvent(new Event('scroll'))
    // Redundant scroll at same offset inside threshold must not re-enable following
    el.dispatchEvent(new Event('scroll'))

    // Streaming growth arrives -> must NOT snap back to bottom
    sized(el, 1080, 400)
    ro.fire()
    expect(el.scrollTop).toBe(595)
    expect((wrapper.vm as unknown as ChatListExpose).atBottom).toBe(false)

    // Small upward wheel step inside threshold stays detached too
    el.scrollTop = 675
    el.dispatchEvent(new Event('scroll'))
    expect((wrapper.vm as unknown as ChatListExpose).atBottom).toBe(true)
    el.dispatchEvent(new WheelEvent('wheel', { deltaY: -4 }))
    el.scrollTop = 671
    el.dispatchEvent(new Event('scroll'))
    sized(el, 1140, 400)
    ro.fire()
    expect(el.scrollTop).toBe(671)

    // Scrolling back down into threshold re-engages following
    el.scrollTop = 730
    el.dispatchEvent(new Event('scroll'))
    sized(el, 1200, 400)
    ro.fire()
    expect(el.scrollTop).toBe(1200)
    wrapper.unmount()
  })

  it('stops following immediately on upward touch drag even before leaving threshold or during streaming/resize/bottomInset updates', async () => {
    const ro = createFakeResizeObserver()
    const wrapper = mount(DouChatList, {
      props: { threshold: 24, bottomInset: 80 },
      slots: { default: '<p>消息</p>' },
      attachTo: document.body,
    })
    const el = wrapper.get('.dou-chat-list__viewport').element as HTMLElement
    sized(el, 2000, 758)
    el.scrollTop = 1242
    el.dispatchEvent(new Event('scroll'))

    // Finger touches down and moves downward (scrolling content UP toward older messages)
    el.dispatchEvent(touchEvent('touchstart', [{ clientY: 500 }]))
    el.dispatchEvent(touchEvent('touchmove', [{ clientY: 505 }]))
    el.scrollTop = 1237
    el.dispatchEvent(new Event('scroll'))

    // Concurrent streaming growth, Safari toolbar viewport resize, and bottomInset update
    sized(el, 2120, 720)
    ro.fire()
    await wrapper.setProps({ bottomInset: 96 })
    await nextTick()
    expect(el.scrollTop).toBe(1237)

    // Finger keeps dragging up and lifts
    el.dispatchEvent(touchEvent('touchmove', [{ clientY: 530 }]))
    el.scrollTop = 1212
    el.dispatchEvent(new Event('scroll'))
    el.dispatchEvent(touchEvent('touchend', []))

    // Further streaming growth after finger lift must still not pull back down
    sized(el, 2240, 720)
    ro.fire()
    expect(el.scrollTop).toBe(1212)
    wrapper.unmount()
  })

  it('defers follow() while finger is resting on viewport and catches up on touchend if user did not scroll up', async () => {
    const ro = createFakeResizeObserver()
    const wrapper = mount(DouChatList, {
      slots: { default: '<p>消息</p>' },
      attachTo: document.body,
    })
    const el = wrapper.get('.dou-chat-list__viewport').element as HTMLElement
    sized(el, 1000, 400)
    el.scrollTop = 600
    el.dispatchEvent(new Event('scroll'))

    // User places finger on viewport without dragging up (e.g., tapping or reading)
    el.dispatchEvent(touchEvent('touchstart', [{ clientY: 500 }]))
    sized(el, 1120, 400)
    ro.fire()
    // Must not yank scrollTop while finger is actively on viewport
    expect(el.scrollTop).toBe(600)

    // Lifting finger without scrolling up catches up to the bottom
    el.dispatchEvent(touchEvent('touchend', []))
    expect(el.scrollTop).toBe(1120)
    wrapper.unmount()
  })

  it('keeps following across horizontal swipes, iOS bottom rubber-band bounces, and content/viewport shrinkage at bottom', async () => {
    const ro = createFakeResizeObserver()
    const wrapper = mount(DouChatList, {
      slots: { default: '<p>消息</p>' },
      attachTo: document.body,
    })
    const el = wrapper.get('.dou-chat-list__viewport').element as HTMLElement
    sized(el, 1000, 400)
    el.scrollTop = 600
    el.dispatchEvent(new Event('scroll'))

    // 1. Horizontal swipe (e.g., wide Markdown table or code block) with slight vertical drift
    el.dispatchEvent(touchEvent('touchstart', [{ clientX: 240, clientY: 500 }]))
    el.dispatchEvent(touchEvent('touchmove', [{ clientX: 160, clientY: 504 }]))
    el.dispatchEvent(touchEvent('touchend', []))
    sized(el, 1050, 400)
    ro.fire()
    expect(el.scrollTop).toBe(1050)

    // 2. iOS bottom rubber-band overscroll (scrollTop > maxTop) and spring-back
    el.scrollTop = 650
    el.dispatchEvent(new Event('scroll'))
    el.dispatchEvent(touchEvent('touchstart', [{ clientY: 500 }]))
    el.dispatchEvent(touchEvent('touchmove', [{ clientY: 460 }]))
    el.scrollTop = 685 // stretched 35px past maxTop = 650
    el.dispatchEvent(new Event('scroll'))
    // Slight finger relaxation downward while still stretched past bottom
    el.dispatchEvent(touchEvent('touchmove', [{ clientY: 468 }]))
    el.dispatchEvent(touchEvent('touchend', []))
    // Rubber-band springs back: 685 -> 665 -> 650
    el.scrollTop = 665
    el.dispatchEvent(new Event('scroll'))
    el.scrollTop = 650
    el.dispatchEvent(new Event('scroll'))
    sized(el, 1120, 400)
    ro.fire()
    expect(el.scrollTop).toBe(1120)

    // 3. Content collapse / keyboard close shrinks maxTop and browser clamps scrollTop down
    el.scrollTop = 720
    el.dispatchEvent(new Event('scroll'))
    sized(el, 850, 400) // maxTop shrinks from 720 -> 450
    el.scrollTop = 450
    el.dispatchEvent(new Event('scroll'))
    sized(el, 960, 400)
    ro.fire()
    expect(el.scrollTop).toBe(960)
    wrapper.unmount()
  })

  it('does not bounce back to bottom in virtual mode when crossing range.from with sub-pixel heights or unmeasured items', async () => {
    const ro = createFakeResizeObserver()
    const items = ref(Array.from({ length: 40 }, (_, id) => ({ id, text: `消息 ${id}` })))
    const wrapper = mount(DouChatList, {
      props: {
        items: items.value,
        itemKey: 'id',
        estimateSize: 120,
        threshold: 24,
        bottomInset: 108,
      },
      slots: {
        item: ({ item }: { item: { id: number; text: string } }) =>
          h('div', { 'data-id': item.id }, item.text),
      },
      attachTo: document.body,
    })
    const el = wrapper.get('.dou-virtual-list').element as HTMLElement
    const spacer = wrapper.get('.dou-virtual-list__spacer').element as HTMLElement

    let scrollHeight = 11_454
    const clientHeight = 758
    let top = 10_696
    let writeCount = 0
    Object.defineProperties(el, {
      scrollHeight: { configurable: true, get: () => scrollHeight },
      clientHeight: { configurable: true, get: () => clientHeight },
      scrollTop: {
        configurable: true,
        get: () => top,
        set: (value: number) => {
          writeCount++
          top = Math.min(Math.max(0, value), Math.max(0, scrollHeight - clientHeight))
        },
      },
    })

    // Initialize at bottom with spacer height 11315.734375
    el.dispatchEvent(new Event('scroll'))
    ro.fire(new Map([[spacer, 11_315.734375]]), (target) => target === spacer)
    await nextTick()
    expect(top).toBe(10_696)
    writeCount = 0

    // Even if a stray sub-pixel spacer fluctuation (-0.015625px) fires ResizeObserver
    // while idle at bottom, DouChatList must not needlessly rewrite scrollTop.
    ro.fire(new Map([[spacer, 11_315.71875]]), (target) => target === spacer)
    expect(writeCount).toBe(0)

    // Simulate 3 upward touch drags in 5px steps crossing the virtual boundary (16px above bottom)
    for (let attempt = 0; attempt < 3; attempt++) {
      let y = 500
      el.dispatchEvent(touchEvent('touchstart', [{ clientY: y }]))
      for (let step = 0; step < 4; step++) {
        y += 5
        el.dispatchEvent(touchEvent('touchmove', [{ clientY: y }]))
        top -= 5
        el.dispatchEvent(new Event('scroll'))
        await nextTick()
        // Simulate sub-pixel spacer resize firing right at virtual boundary
        ro.fire(new Map([[spacer, 11_315.71875]]), (target) => target === spacer)
      }
      el.dispatchEvent(touchEvent('touchend', []))
    }

    // 3 attempts * 4 steps * 5px = 60px scrolled up cleanly, zero bounce-back writes
    expect(top).toBe(10_696 - 60)
    expect(writeCount).toBe(0)

    // Also verify when an unmeasured item above viewport grows by +245px during upward scroll
    // inside threshold, the anchor shift does not falsely flip following back on.
    top = 10_696
    el.dispatchEvent(new Event('scroll'))
    // Return to bottom so following is true again
    ro.fire(new Map([[spacer, 11_315.734375]]), (target) => target === spacer)
    el.dispatchEvent(touchEvent('touchstart', [{ clientY: 500 }]))
    el.dispatchEvent(touchEvent('touchmove', [{ clientY: 516 }]))
    top = 10_680 // 16px from bottom (inside threshold 24)
    el.dispatchEvent(new Event('scroll'))
    // Unmeasured item above viewport grows by +245px (scrollHeight +245, anchor shift +246 due to rounding)
    scrollHeight += 245
    top += 246
    el.dispatchEvent(new Event('scroll'))
    ro.fire(new Map([[spacer, 11_560.734375]]), (target) => target === spacer)
    el.dispatchEvent(touchEvent('touchend', []))
    // Must stay at anchored position (10680 + 246 = 10926), NOT bounced to maxTop (10941)!
    expect(top).toBe(10_926)

    wrapper.unmount()
  })

  it('handles mid-gesture direction reversal and touchcancel / document touchend cleanup', async () => {
    const ro = createFakeResizeObserver()
    const wrapper = mount(DouChatList, {
      props: { threshold: 24 },
      slots: { default: '<p>消息</p>' },
      attachTo: document.body,
    })
    const el = wrapper.get('.dou-chat-list__viewport').element as HTMLElement
    sized(el, 1000, 400)
    el.scrollTop = 600
    el.dispatchEvent(new Event('scroll'))

    // Drag up 100px (following = false), then reverse back down to bottom without lifting finger
    el.dispatchEvent(touchEvent('touchstart', [{ clientY: 500 }]))
    el.dispatchEvent(touchEvent('touchmove', [{ clientY: 600 }]))
    el.scrollTop = 500
    el.dispatchEvent(new Event('scroll'))
    // Reverse downward back into threshold
    el.dispatchEvent(touchEvent('touchmove', [{ clientY: 510 }]))
    el.scrollTop = 590
    el.dispatchEvent(new Event('scroll'))
    // Content grows while finger still on screen -> deferred until release
    sized(el, 1080, 400)
    ro.fire()
    expect(el.scrollTop).toBe(590)
    // Released via document touchcancel (e.g., system gesture or unmounted touch target)
    document.dispatchEvent(touchEvent('touchcancel', []))
    expect(el.scrollTop).toBe(1080)

    wrapper.unmount()
  })

  it('does not treat high-DPI fractional scrollTop at rest as bottom overscroll bounce', () => {
    const ro = createFakeResizeObserver()
    const wrapper = mount(DouChatList, {
      props: { threshold: 24 },
      slots: { default: '<p>消息</p>' },
      attachTo: document.body,
    })
    const el = wrapper.get('.dou-chat-list__viewport').element as HTMLElement
    sized(el, 1000, 400)
    // On DPR=3 screens, scrollTop at rest can exceed integer (scrollHeight - clientHeight) by < 1px
    el.scrollTop = 600.333
    el.dispatchEvent(new Event('scroll'))

    el.dispatchEvent(touchEvent('touchstart', [{ clientY: 500 }]))
    el.dispatchEvent(touchEvent('touchmove', [{ clientY: 506 }]))
    el.scrollTop = 594
    el.dispatchEvent(new Event('scroll'))
    el.dispatchEvent(touchEvent('touchend', []))

    // Content grows right after upward drag -> must NOT snap back to bottom
    sized(el, 1120, 400)
    ro.fire()
    expect(el.scrollTop).toBe(594)

    wrapper.unmount()
  })

  it('does not re-engage following when ResizeObserver/scroll fires before anchor shiftScroll catches up', async () => {
    const ro = createFakeResizeObserver()
    let touch!: ReturnType<typeof useTouchScroll>
    const Host = defineComponent({
      setup() {
        touch = useTouchScroll()
        return () => h(DouChatList, { threshold: 24 }, { default: () => h('p', '消息') })
      },
    })
    const wrapper = mount(Host, { attachTo: document.body })
    const el = wrapper.get('.dou-chat-list__viewport').element as HTMLElement

    let scrollHeight = 11_454
    const clientHeight = 758
    let top = 10_696
    let dropWrites = false
    Object.defineProperty(el, 'scrollHeight', { configurable: true, get: () => scrollHeight })
    Object.defineProperty(el, 'clientHeight', { configurable: true, get: () => clientHeight })
    Object.defineProperty(el, 'scrollTop', {
      configurable: true,
      get: () => top,
      set: (value: number) => {
        if (!dropWrites) top = value
      },
    })
    el.dispatchEvent(new Event('scroll'))

    // User flicks up inside threshold (16px from bottom) and lifts finger; momentum continues
    el.dispatchEvent(touchEvent('touchstart', [{ clientY: 500 }]))
    el.dispatchEvent(touchEvent('touchmove', [{ clientY: 516 }]))
    top = 10_680
    el.dispatchEvent(new Event('scroll'))
    el.dispatchEvent(touchEvent('touchend', []))

    // Item above viewport mounts (+245px) and a scroll event arrives BEFORE shiftScroll runs
    scrollHeight += 245 // maxTop = 10941
    top = 10_675 // user momentum moved up another 5px
    el.dispatchEvent(new Event('scroll'))

    // Now useMeasuredSizes shifts scroll by +245 while iOS drops writes during momentum
    dropWrites = true
    touch.shiftScroll(el, 245)
    expect(touch.pendingShift(el)).toBe(245)

    // Next momentum scroll event moves up another 5px: logicalTop jumps from 10675 to 10915
    // (dist drops from 266 to 26, or even 20 inside threshold if step was 0)
    top = 10_675
    el.dispatchEvent(new Event('scroll'))

    // Streaming/spacer ResizeObserver runs after momentum -> must NOT snap to bottom!
    dropWrites = false
    scrollHeight += 60
    ro.fire()
    expect(top).toBe(10_675)

    wrapper.unmount()
  })

  it('does not re-engage following when makeLost() rounds a fractional shift up', () => {
    vi.useFakeTimers()
    const ro = createFakeResizeObserver()
    let touch!: ReturnType<typeof useTouchScroll>
    const Host = defineComponent({
      setup() {
        touch = useTouchScroll()
        return () => h(DouChatList, { threshold: 24 }, { default: () => h('p', '消息') })
      },
    })
    const wrapper = mount(Host, { attachTo: document.body })
    const el = wrapper.get('.dou-chat-list__viewport').element as HTMLElement

    let scrollHeight = 11_454
    const clientHeight = 758
    let top = 10_696
    let dropWrites = false
    Object.defineProperty(el, 'scrollHeight', { configurable: true, get: () => scrollHeight })
    Object.defineProperty(el, 'clientHeight', { configurable: true, get: () => clientHeight })
    Object.defineProperty(el, 'scrollTop', {
      configurable: true,
      get: () => top,
      set: (value: number) => {
        if (dropWrites) return
        const maxTop = Math.max(0, scrollHeight - clientHeight)
        top = Math.min(maxTop, Math.max(0, Math.round(value)))
      },
    })
    el.dispatchEvent(new Event('scroll'))

    // User scrolls up inside threshold (following = false) and lifts finger
    el.dispatchEvent(touchEvent('touchstart', [{ clientY: 500 }]))
    el.dispatchEvent(touchEvent('touchmove', [{ clientY: 516 }]))
    top = 10_680
    el.dispatchEvent(new Event('scroll'))
    el.dispatchEvent(touchEvent('touchend', []))

    // Item above grows by a fractional borderBox height while iOS drops scrollTop writes
    scrollHeight += 246 // maxTop = 10942
    dropWrites = true
    touch.shiftScroll(el, 245.984375)
    expect(touch.pendingShift(el)).toBeCloseTo(245.984375, 6)

    // Momentum scroll event inside threshold with logicalTop = 10675 + 245.984375 = 10920.984375
    top = 10_675
    el.dispatchEvent(new Event('scroll'))

    // Settle applies makeLost() -> 10920.984375 rounds UP to 10921 (+0.015625px)
    dropWrites = false
    vi.advanceTimersByTime(200)
    expect(top).toBe(10_921)
    el.dispatchEvent(new Event('scroll'))

    // Must NOT falsely flip following back to true on the +0.015625px quantization diff
    scrollHeight += 80
    ro.fire()
    expect(top).toBe(10_921)

    wrapper.unmount()
  })

  it('keeps following enabled when makeLost() floors a fractional shift down', () => {
    vi.useFakeTimers()
    const ro = createFakeResizeObserver()
    let touch!: ReturnType<typeof useTouchScroll>
    const Host = defineComponent({
      setup() {
        touch = useTouchScroll()
        return () => h(DouChatList, { threshold: 24 }, { default: () => h('p', '消息') })
      },
    })
    const wrapper = mount(Host, { attachTo: document.body })
    const el = wrapper.get('.dou-chat-list__viewport').element as HTMLElement

    let scrollHeight = 11_454
    const clientHeight = 758
    let top = 10_696
    let dropWrites = false
    Object.defineProperty(el, 'scrollHeight', { configurable: true, get: () => scrollHeight })
    Object.defineProperty(el, 'clientHeight', { configurable: true, get: () => clientHeight })
    Object.defineProperty(el, 'scrollTop', {
      configurable: true,
      get: () => top,
      set: (value: number) => {
        if (dropWrites) return
        const maxTop = Math.max(0, scrollHeight - clientHeight)
        top = Math.min(maxTop, Math.max(0, Math.floor(value)))
      },
    })
    el.dispatchEvent(new Event('scroll'))

    // User stays at bottom (following = true) while a touch scroll happens without upward drag
    document.dispatchEvent(touchEvent('touchstart', [{ clientY: 500 }]))
    scrollHeight += 246 // maxTop = 10942
    dropWrites = true
    touch.shiftScroll(el, 245.984375)
    expect(touch.pendingShift(el)).toBeCloseTo(245.984375, 6)

    // Scroll event observes logicalTop = 10696 + 245.984375 = 10941.984375
    el.dispatchEvent(new Event('scroll'))
    document.dispatchEvent(touchEvent('touchend', []))

    // Settle applies makeLost() -> 10941.984375 floors DOWN to 10941 (-0.984375px)
    dropWrites = false
    vi.advanceTimersByTime(200)
    expect(top).toBe(10_941)
    el.dispatchEvent(new Event('scroll'))

    // Must NOT falsely turn following off on the -0.984375px quantization diff
    scrollHeight += 80
    ro.fire()
    expect(top).toBe(scrollHeight - clientHeight)

    wrapper.unmount()
  })

  it('does not flip following back to true while a negative shift is awaiting async drop verification', () => {
    vi.useFakeTimers()
    const ro = createFakeResizeObserver()
    let touch!: ReturnType<typeof useTouchScroll>
    const listRef = ref<ChatListExpose>()
    const Host = defineComponent({
      setup() {
        touch = useTouchScroll()
        return () =>
          h(DouChatList, { ref: listRef, threshold: 24 }, { default: () => h('p', '消息') })
      },
    })
    const wrapper = mount(Host, { attachTo: document.body })
    const el = wrapper.get('.dou-chat-list__viewport').element as HTMLElement

    let scrollHeight = 1400
    const clientHeight = 400
    let top = 1000
    Object.defineProperty(el, 'scrollHeight', { configurable: true, get: () => scrollHeight })
    Object.defineProperty(el, 'clientHeight', { configurable: true, get: () => clientHeight })
    Object.defineProperty(el, 'scrollTop', {
      configurable: true,
      get: () => top,
      set: (value: number) => {
        top = value
      },
    })
    el.dispatchEvent(new Event('scroll'))

    // Quick upward flick and finger lift (touchDirection resets to null, momentum active)
    el.dispatchEvent(touchEvent('touchstart', [{ clientY: 500 }]))
    el.dispatchEvent(touchEvent('touchmove', [{ clientY: 510 }]))
    el.dispatchEvent(touchEvent('touchend', []))

    // First scroll event of this touch (step is still undefined in useTouchScroll)
    top = 990
    el.dispatchEvent(new Event('scroll'))

    // Shorter item mounts above (-70px) while bottom grows (+60px), net scrollHeight = 1390 (maxTop = 990)
    scrollHeight = 1390
    touch.shiftScroll(el, -70)
    expect(top).toBe(920)
    // Scroll event for the write itself runs
    el.dispatchEvent(new Event('scroll'))

    // Next momentum frame: iOS asynchronously drops the -70 write back to `from` (990, inside threshold).
    // checkShift records shift.first = 990 without setting pendingShift yet.
    top = 990
    el.dispatchEvent(new Event('scroll'))

    // Settle detects the dropped shift and restores -70 via makeLost()
    vi.advanceTimersByTime(200)
    expect(top).toBe(920)
    el.dispatchEvent(new Event('scroll'))

    // Subsequent streaming growth must NOT snap back to bottom
    scrollHeight = 1500
    ro.fire()
    expect(top).toBe(920)

    // Re-enter following via scrollToBottom, then verify the 2nd-momentum-event path
    // where checkShift confirms wasDropped before settle().
    scrollHeight = 1400
    listRef.value!.scrollToBottom('auto')
    top = 1000
    el.dispatchEvent(new Event('scroll'))

    el.dispatchEvent(touchEvent('touchstart', [{ clientY: 500 }]))
    el.dispatchEvent(touchEvent('touchmove', [{ clientY: 510 }]))
    el.dispatchEvent(touchEvent('touchend', []))

    top = 990
    el.dispatchEvent(new Event('scroll'))
    scrollHeight = 1390
    touch.shiftScroll(el, -70)
    expect(top).toBe(920)
    el.dispatchEvent(new Event('scroll'))

    // 1st momentum event after shift: iOS drops -70 back to 985 (5px upward momentum from 990)
    top = 985
    el.dispatchEvent(new Event('scroll'))
    // 2nd momentum event: another -5px to 980 -> checkShift confirms wasDropped and sets pendingShift = -70
    top = 980
    el.dispatchEvent(new Event('scroll'))
    expect(touch.pendingShift(el)).toBe(-70)

    vi.advanceTimersByTime(200)
    expect(top).toBe(910)
    el.dispatchEvent(new Event('scroll'))

    scrollHeight = 1520
    ro.fire()
    expect(top).toBe(910)

    wrapper.unmount()
  })

  it('detects bottom rubber-band overscroll from native scrollTop rather than pendingShift', () => {
    vi.useFakeTimers()
    const ro = createFakeResizeObserver()
    let touch!: ReturnType<typeof useTouchScroll>
    const Host = defineComponent({
      setup() {
        touch = useTouchScroll()
        return () => h(DouChatList, { threshold: 24 }, { default: () => h('p', '消息') })
      },
    })
    const wrapper = mount(Host, { attachTo: document.body })
    const el = wrapper.get('.dou-chat-list__viewport').element as HTMLElement

    let scrollHeight = 1000
    const clientHeight = 400
    let top = 600
    let dropWrites = false
    Object.defineProperty(el, 'scrollHeight', { configurable: true, get: () => scrollHeight })
    Object.defineProperty(el, 'clientHeight', { configurable: true, get: () => clientHeight })
    Object.defineProperty(el, 'scrollTop', {
      configurable: true,
      get: () => top,
      set: (value: number) => {
        if (!dropWrites) top = value
      },
    })
    el.dispatchEvent(new Event('scroll'))

    // 1. Negative pendingShift while natively bouncing past bottom must still count as bouncing
    el.dispatchEvent(touchEvent('touchstart', [{ clientY: 500 }]))
    el.dispatchEvent(touchEvent('touchmove', [{ clientY: 460 }]))
    top = 625 // 25px past maxTop = 600
    el.dispatchEvent(new Event('scroll'))
    dropWrites = true
    touch.shiftScroll(el, -40)
    expect(touch.pendingShift(el)).toBe(-40)

    // Relaxing the finger downward while still natively stretched past bottom must keep following = true
    el.dispatchEvent(touchEvent('touchmove', [{ clientY: 472 }]))
    // Content grows slightly (maxTop = 610), keeping native top = 625 still bouncing past bottom
    scrollHeight = 1010
    ro.fire()
    // Lifting finger while still natively bouncing must defer follow() until settled
    el.dispatchEvent(touchEvent('touchend', []))
    expect(top).toBe(625)

    // After bounce finishes and touch settles, deferred follow() snaps to bottom
    dropWrites = false
    top = 600
    el.dispatchEvent(new Event('scroll'))
    vi.advanceTimersByTime(200)
    expect(top).toBe(1010)

    // 2. Positive pendingShift after content below collapses must NOT mask a real upward drag
    top = 610
    el.dispatchEvent(new Event('scroll'))
    el.dispatchEvent(touchEvent('touchstart', [{ clientY: 500 }]))
    scrollHeight = 1250
    dropWrites = true
    touch.shiftScroll(el, 200)
    expect(touch.pendingShift(el)).toBe(200)

    // Content below collapses so maxTop = 600 while native top = 580 (< maxTop, NOT bouncing)
    scrollHeight = 1000
    top = 580
    el.dispatchEvent(new Event('scroll'))
    // Real upward touch drag must turn following = false immediately despite top + pendingShift > maxTop
    el.dispatchEvent(touchEvent('touchmove', [{ clientY: 524 }]))
    top = 556
    el.dispatchEvent(new Event('scroll'))
    el.dispatchEvent(touchEvent('touchend', []))

    dropWrites = false
    vi.advanceTimersByTime(200)
    const settledTop = top
    scrollHeight = 1160
    ro.fire()
    expect(top).toBe(settledTop)

    wrapper.unmount()
  })

  it('defers follow() when streaming growth arrives during post-touchend bottom rubber-band bounce', () => {
    vi.useFakeTimers()
    const ro = createFakeResizeObserver()
    const wrapper = mount(DouChatList, {
      slots: { default: '<p>消息</p>' },
      attachTo: document.body,
    })
    const el = wrapper.get('.dou-chat-list__viewport').element as HTMLElement

    let scrollHeight = 1000
    const clientHeight = 400
    let top = 600
    let dropWrites = false
    let writeCount = 0
    Object.defineProperty(el, 'scrollHeight', { configurable: true, get: () => scrollHeight })
    Object.defineProperty(el, 'clientHeight', { configurable: true, get: () => clientHeight })
    Object.defineProperty(el, 'scrollTop', {
      configurable: true,
      get: () => top,
      set: (value: number) => {
        writeCount++
        if (!dropWrites) top = value
      },
    })
    el.dispatchEvent(new Event('scroll'))
    writeCount = 0

    // User stretches past bottom, content grows while touching, then lifts finger
    el.dispatchEvent(touchEvent('touchstart', [{ clientY: 500 }]))
    el.dispatchEvent(touchEvent('touchmove', [{ clientY: 450 }]))
    top = 640 // stretched 40px past maxTop = 600
    el.dispatchEvent(new Event('scroll'))
    scrollHeight = 1010
    ro.fire()
    el.dispatchEvent(touchEvent('touchend', []))
    expect(writeCount).toBe(0)

    // While still in post-touchend rubber-band bounce (top = 630 > maxTop + 1 = 626),
    // new streaming output arrives and iOS would drop any immediate scrollTop write.
    dropWrites = true
    top = 630
    el.dispatchEvent(new Event('scroll'))
    scrollHeight = 1025
    ro.fire()
    expect(writeCount).toBe(0)

    // Bounce-back animation lands at 600, then settles -> deferred flushPendingFollow() catches up
    dropWrites = false
    top = 600
    el.dispatchEvent(new Event('scroll'))
    vi.advanceTimersByTime(200)
    expect(writeCount).toBe(1)
    expect(top).toBe(1025)

    wrapper.unmount()
  })
})
