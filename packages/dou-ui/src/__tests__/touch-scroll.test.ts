import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import {
  createScrollLink,
  DouChatList,
  DouVirtualList,
  scrollPositionOf,
  useTouchScroll,
} from '../index'

// happy-dom lays nothing out: sizes are set by hand, and resize notices sent by hand
let observers: FakeObserver[] = []
class FakeObserver {
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
function resizeAll() {
  for (const observer of observers) {
    const entries = [...observer.elements].map((target) => ({ target }) as ResizeObserverEntry)
    observer.callback(entries, observer as unknown as ResizeObserver)
  }
}

function sized(el: HTMLElement, size: { width?: number; height?: number; client?: number }) {
  const client = size.client ?? 100
  Object.defineProperties(el, {
    scrollHeight: { configurable: true, get: () => size.height ?? client },
    scrollWidth: { configurable: true, get: () => size.width ?? client },
    clientHeight: { configurable: true, get: () => client },
    clientWidth: { configurable: true, get: () => client },
  })
}

/** A scroll position as iOS reports it, past an end while bouncing. */
function position(el: HTMLElement, top = 0, left = 0) {
  Object.defineProperty(el, 'scrollTop', { configurable: true, writable: true, value: top })
  Object.defineProperty(el, 'scrollLeft', { configurable: true, writable: true, value: left })
}

const touch = (type: string) =>
  document.dispatchEvent(
    Object.assign(new Event(type, { bubbles: true }), {
      touches: type === 'touchstart' ? [{}] : [],
    }),
  )

beforeEach(() => {
  observers = []
  vi.stubGlobal('ResizeObserver', FakeObserver)
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
  document.body.innerHTML = ''
})

describe('scrollPositionOf', () => {
  it('keeps a bouncing position inside the scroll range', () => {
    const el = document.createElement('div')
    sized(el, { height: 500, width: 300 })
    position(el, -40, 260)
    expect(scrollPositionOf(el)).toEqual({ top: 0, left: 200 })
    position(el, 520, -3)
    expect(scrollPositionOf(el)).toEqual({ top: 400, left: 0 })
  })
})

describe('createScrollLink', () => {
  it('follows the leader and skips the echo of its own write', () => {
    const a = document.createElement('div')
    const b = document.createElement('div')
    sized(a, { height: 1000 })
    sized(b, { height: 1000 })
    position(a)
    position(b)
    const link = createScrollLink('y')
    a.scrollTop = 120
    link.follow(a, b)
    expect(b.scrollTop).toBe(120)
    // a went on with its momentum before b's scroll event came in
    a.scrollTop = 180
    link.follow(b, a)
    expect(a.scrollTop).toBe(180)
    link.follow(a, b)
    expect(b.scrollTop).toBe(180)
    // a bounce past the start is followed to the start only
    a.scrollTop = -30
    link.follow(a, b)
    expect(b.scrollTop).toBe(0)
  })
})

describe('useTouchScroll', () => {
  it('waits for the finger to lift and the scrolling to stop', async () => {
    vi.useFakeTimers()
    let touchScroll!: ReturnType<typeof useTouchScroll>
    const wrapper = mount(
      defineComponent({
        setup() {
          touchScroll = useTouchScroll()
          return () => h('div')
        },
      }),
      { attachTo: document.body },
    )
    const done = vi.fn<() => void>()
    touchScroll.whenSettled(done)
    expect(done).toHaveBeenCalledTimes(1)

    touch('touchstart')
    expect(touchScroll.active()).toBe(true)
    touchScroll.whenSettled(done)
    touchScroll.whenSettled(done)
    vi.advanceTimersByTime(500)
    expect(done).toHaveBeenCalledTimes(1)
    touch('touchend')
    // momentum keeps it going
    vi.advanceTimersByTime(100)
    document.dispatchEvent(new Event('scroll'))
    vi.advanceTimersByTime(100)
    expect(done).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(100)
    expect(done).toHaveBeenCalledTimes(2)
    expect(touchScroll.active()).toBe(false)
    wrapper.unmount()
  })
})

const make = (from: number, count: number) =>
  Array.from({ length: count }, (_, index) => ({ id: from + index }))

function list() {
  const items = ref(make(0, 100))
  const wrapper = mount(
    defineComponent(
      () => () =>
        h(
          DouVirtualList,
          { items: items.value, itemKey: 'id', estimateSize: 50, height: 200 },
          {
            default: () => 'x',
          },
        ),
    ),
    { attachTo: document.body },
  )
  const el = wrapper.get('.dou-virtual-list').element as HTMLElement
  sized(el, { height: 10_000, client: 200 })
  position(el)
  return { wrapper, items, el }
}
describe('loading earlier items at the top', () => {
  it('keeps the first item in view when the list is at the very top', async () => {
    const { wrapper, items, el } = list()
    el.dispatchEvent(new Event('scroll'))
    items.value = [...make(-10, 10), ...items.value]
    await nextTick()
    await nextTick()
    expect(el.scrollTop).toBe(500)
    wrapper.unmount()
  })

  it('waits for a touch scroll to end, then adds what the reader scrolled meanwhile', async () => {
    vi.useFakeTimers()
    const { wrapper, items, el } = list()
    touch('touchstart')
    el.scrollTop = -20
    el.dispatchEvent(new Event('scroll'))
    items.value = [...make(-10, 10), ...items.value]
    await nextTick()
    await nextTick()
    // iOS would drop a position written now
    expect(el.scrollTop).toBe(-20)
    touch('touchend')
    el.scrollTop = 30
    el.dispatchEvent(new Event('scroll'))
    vi.advanceTimersByTime(200)
    expect(el.scrollTop).toBe(530)
    wrapper.unmount()
  })

  it('reports the top of a chat list after the bounce, and keeps the first message in place', async () => {
    vi.useFakeTimers()
    const messages = ref(['a', 'b'])
    const wrapper = mount(
      defineComponent({
        emits: ['topReached'],
        setup(_, { emit }) {
          return () =>
            h(
              DouChatList,
              { onTopReached: () => emit('topReached') },
              {
                default: () => messages.value.map((text) => h('p', { key: text, id: text }, text)),
              },
            )
        },
      }),
      { attachTo: document.body },
    )
    const viewport = wrapper.get('.dou-chat-list__viewport').element as HTMLElement
    const content = wrapper.get('.dou-chat-list__content').element as HTMLElement
    sized(viewport, { height: 1000 })
    position(viewport, 300)
    viewport.dispatchEvent(new Event('scroll'))

    touch('touchstart')
    viewport.scrollTop = -40
    viewport.dispatchEvent(new Event('scroll'))
    touch('touchend')
    viewport.scrollTop = 0
    viewport.dispatchEvent(new Event('scroll'))
    expect(wrapper.emitted('topReached')).toBeUndefined()
    vi.advanceTimersByTime(200)
    expect(wrapper.emitted('topReached')).toHaveLength(1)

    // earlier messages arrive above the first one
    messages.value = ['y', 'z', 'a', 'b']
    await nextTick()
    const a = content.querySelector('#a')!
    a.getBoundingClientRect = () => ({ top: 240 }) as DOMRect
    resizeAll()
    expect(viewport.scrollTop).toBe(240)
    wrapper.unmount()
  })
})
