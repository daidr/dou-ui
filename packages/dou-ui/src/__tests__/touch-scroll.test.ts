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
    expect(touchScroll.active.value).toBe(true)
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
    expect(touchScroll.active.value).toBe(false)
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
describe('shiftScroll', () => {
  it('settles a move still waiting for word when the touch scroll ends', async () => {
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
    const el = document.createElement('div')
    document.body.append(el)
    let top = 1000
    Object.defineProperty(el, 'scrollTop', {
      configurable: true,
      get: () => top,
      set: (value: number) => {
        top = value
      },
    })
    const scroll = () => el.dispatchEvent(new Event('scroll'))
    touch('touchstart')
    top = 990
    scroll()
    top = 980
    scroll()
    touch('touchend')
    // the move holds and fires its own scroll event, and then nothing moves
    touchScroll.shiftScroll(el, 200)
    scroll()
    vi.advanceTimersByTime(500)
    expect(top).toBe(1180)
    // much later, a quick scroll up by 300
    top = 880
    scroll()
    vi.advanceTimersByTime(500)
    expect(top).toBe(880)
    wrapper.unmount()
  })

  it('takes a move early in a touch, against the scroll, as held', async () => {
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
    const el = document.createElement('div')
    document.body.append(el)
    let top = 1030
    Object.defineProperty(el, 'scrollTop', {
      configurable: true,
      get: () => top,
      set: (value: number) => {
        top = value
      },
    })
    const scroll = () => el.dispatchEvent(new Event('scroll'))
    touch('touchstart')
    // the first event of this touch: no step yet
    top = 1000
    scroll()
    // an item above grew; the move holds and fires its own event
    touchScroll.shiftScroll(el, 19)
    scroll()
    // the finger goes on up
    top = 989
    scroll()
    top = 959
    scroll()
    touch('touchend')
    vi.advanceTimersByTime(500)
    expect(top).toBe(959)
    wrapper.unmount()
  })

  it('recovers a large dropped move across top bounce reversal, top clamping, and variable drag', () => {
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
    const el = document.createElement('div')
    document.body.append(el)
    sized(el, { height: 20_000, client: 600 })
    let top = 0
    Object.defineProperty(el, 'scrollTop', {
      configurable: true,
      get: () => top,
      set: (value: number) => {
        top = value
      },
    })
    const scroll = (next: number) => {
      top = next
      el.dispatchEvent(new Event('scroll'))
    }

    // 1. Top rubber-band bounce reversal: from = -20, step = -15 -> next frame reverses to -10
    touch('touchstart')
    scroll(-5)
    scroll(-20)
    touchScroll.shiftScroll(el, 4800)
    // iOS accepted the write briefly, then overwrote back to bounce trajectory (-10)
    scroll(-10)
    touch('touchend')
    scroll(0)
    vi.advanceTimersByTime(200)
    expect(top).toBe(4800)

    // 2. Top boundary clamp: from = 10, step = -60 -> hits top at -10
    touch('touchstart')
    scroll(70)
    scroll(10)
    touchScroll.shiftScroll(el, 4800)
    scroll(-10)
    touch('touchend')
    scroll(0)
    vi.advanceTimersByTime(200)
    expect(top).toBe(4800)

    // 3. Variable-speed finger drag: from = 100, step = -2 -> accelerates to 65 (-35)
    touch('touchstart')
    scroll(102)
    scroll(100)
    touchScroll.shiftScroll(el, 4800)
    scroll(65)
    touch('touchend')
    vi.advanceTimersByTime(200)
    expect(top).toBe(4865)

    // 4. Negative bounce from = -12 settling at 0 with no subsequent scroll event
    touch('touchstart')
    scroll(-12)
    touchScroll.shiftScroll(el, 4800)
    // iOS silently settles back at 0 without another non-echo scroll event
    top = 0
    touch('touchend')
    vi.advanceTimersByTime(200)
    expect(top).toBe(4800)

    wrapper.unmount()
  })

  it('preserves cumulative targets across consecutive dropped shiftScroll calls', () => {
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
    const el = document.createElement('div')
    document.body.append(el)
    sized(el, { height: 20_000, client: 600 })
    let top = 200
    let drop = false
    Object.defineProperty(el, 'scrollTop', {
      configurable: true,
      get: () => top,
      set: (value: number) => {
        if (!drop) top = value
      },
    })

    // First write accepted, then silently reverted by iOS before second write
    touch('touchstart')
    touchScroll.shiftScroll(el, 500)
    expect(top).toBe(700)
    top = 200
    touchScroll.shiftScroll(el, 100)
    // Target must accumulate to 800, not overwrite to 300
    expect(top).toBe(800)
    // Now iOS overwrites back to 200 and settles
    top = 200
    touch('touchend')
    vi.advanceTimersByTime(200)
    expect(top).toBe(800)

    // Consecutive synchronous drops accumulate cleanly (including negative corrections at scrollTop = 0)
    top = 0
    drop = true
    touch('touchstart')
    touchScroll.shiftScroll(el, 6000)
    touchScroll.shiftScroll(el, -237)
    expect(touchScroll.pendingShift(el)).toBe(5763)
    touch('touchend')
    drop = false
    vi.advanceTimersByTime(200)
    expect(top).toBe(5763)
    expect(touchScroll.pendingShift(el)).toBe(0)

    wrapper.unmount()
  })

  it('does not record a fake pendingShift when a laid-out short container clamps scrollTop to 0', () => {
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
    const el = document.createElement('div')
    document.body.append(el)
    // Container is laid out (clientHeight > 0), content fits inside viewport (scrollHeight <= clientHeight)
    sized(el, { height: 240, client: 400 })
    let top = 0
    Object.defineProperty(el, 'scrollTop', {
      configurable: true,
      get: () => top,
      set: (value: number) => {
        const max = Math.max(0, el.scrollHeight - el.clientHeight)
        top = Math.min(Math.max(0, value), max)
      },
    })

    touch('touchstart')
    touchScroll.shiftScroll(el, 80)
    expect(top).toBe(0)
    expect(touchScroll.pendingShift(el)).toBe(0)
    touch('touchend')
    vi.advanceTimersByTime(200)
    expect(top).toBe(0)
    expect(touchScroll.pendingShift(el)).toBe(0)
    wrapper.unmount()
  })

  it('preserves and folds a follow-up shift when a prior small shift already dropped on its first scroll event', () => {
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
    const el = document.createElement('div')
    document.body.append(el)
    sized(el, { height: 20_000, client: 600 })
    let top = 0
    let writes = 0
    Object.defineProperty(el, 'scrollTop', {
      configurable: true,
      get: () => top,
      set: (value: number) => {
        writes++
        top = value
      },
    })

    touch('touchstart')
    // No step yet; shift +120px is accepted transiently, then iOS snaps scrollTop back to 0
    touchScroll.shiftScroll(el, 120)
    expect(top).toBe(120)
    expect(writes).toBe(1)
    top = 0
    el.dispatchEvent(new Event('scroll'))
    // Follow-up ResizeObserver shift arrives before a second scroll event
    touchScroll.shiftScroll(el, 40)
    // Must fold into pendingShift (120 + 40 = 160) without overwriting el.scrollTop again
    expect(writes).toBe(1)
    expect(top).toBe(0)
    expect(touchScroll.pendingShift(el)).toBe(160)

    // Subsequent negative correction folds cleanly too
    touchScroll.shiftScroll(el, -20)
    expect(writes).toBe(1)
    expect(touchScroll.pendingShift(el)).toBe(140)

    touch('touchend')
    vi.advanceTimersByTime(200)
    expect(top).toBe(140)
    expect(touchScroll.pendingShift(el)).toBe(0)
    wrapper.unmount()
  })
})

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

  it('moves right away during a touch scroll where the browser takes the move', async () => {
    vi.useFakeTimers()
    const { wrapper, items, el } = list()
    touch('touchstart')
    for (const top of [320, 300]) {
      el.scrollTop = top
      el.dispatchEvent(new Event('scroll'))
    }
    items.value = [...make(-10, 10), ...items.value]
    await nextTick()
    await nextTick()
    expect(el.scrollTop).toBe(800)
    // the finger goes on from there
    el.scrollTop = 790
    el.dispatchEvent(new Event('scroll'))
    touch('touchend')
    vi.advanceTimersByTime(200)
    expect(el.scrollTop).toBe(790)
    wrapper.unmount()
  })

  it('makes a move iOS dropped once the touch scroll is over', async () => {
    vi.useFakeTimers()
    const { wrapper, items, el } = list()
    // iOS: a position written during the touch scroll is dropped
    let top = 0
    let drop = true
    Object.defineProperty(el, 'scrollTop', {
      configurable: true,
      get: () => top,
      set: (value: number) => {
        if (!drop) top = value
      },
    })
    const scrollTo = (value: number) => {
      top = value
      el.dispatchEvent(new Event('scroll'))
    }
    touch('touchstart')
    scrollTo(300)
    scrollTo(290)
    items.value = [...make(-10, 10), ...items.value]
    await nextTick()
    await nextTick()
    expect(el.scrollTop).toBe(290)
    // momentum goes on from where it was, not from where the move took it
    scrollTo(280)
    touch('touchend')
    scrollTo(270)
    drop = false
    vi.advanceTimersByTime(200)
    expect(el.scrollTop).toBe(770)
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

  it('keeps the anchor and avoids duplicate topReached when async history arrives during iOS touch bounce', async () => {
    vi.useFakeTimers()
    const items = ref(make(40, 60))
    const wrapper = mount(
      defineComponent({
        emits: ['topReached'],
        setup(_, { emit }) {
          return () =>
            h(
              DouChatList,
              {
                items: items.value,
                itemKey: 'id',
                estimateSize: 120,
                onTopReached: () => emit('topReached'),
              },
              {
                item: ({ item }: { item: { id: number } }) =>
                  h('div', { 'data-id': item.id }, `#${item.id}`),
              },
            )
        },
      }),
      { attachTo: document.body },
    )
    const el = wrapper.get('.dou-virtual-list').element as HTMLElement
    sized(el, { height: 20_000, client: 480 })
    let top = 0
    let drop = false
    Object.defineProperty(el, 'scrollTop', {
      configurable: true,
      get: () => top,
      set: (value: number) => {
        if (!drop) top = value
      },
    })
    const scrollTo = (value: number) => {
      top = value
      el.dispatchEvent(new Event('scroll'))
    }

    // Scroll to the top so anchor is locked onto item 40 and topReached fires
    scrollTo(120)
    scrollTo(0)
    expect(wrapper.emitted('topReached')).toHaveLength(1)

    // While async history is loading, user touches again and bounces at the top
    drop = true
    touch('touchstart')
    scrollTo(10)
    scrollTo(-15)

    // 40 older messages arrive (40 * 120 = +4800px) while iOS drops scrollTop writes
    items.value = [...make(0, 40), ...items.value]
    await nextTick()
    await nextTick()

    // Anchor must stay on item 40, not jump to item 0
    expect(el.scrollTop).toBe(-15)
    expect(wrapper.find('[data-id="0"]').exists()).toBe(false)
    expect(wrapper.find('[data-id="40"]').exists()).toBe(true)
    expect(wrapper.get('.dou-virtual-list__spacer').attributes('style')).toContain(
      'translateY(-4800px)',
    )

    // Bounce returns toward 0 and finishes
    scrollTo(-5)
    touch('touchend')
    scrollTo(0)
    drop = false
    vi.advanceTimersByTime(200)
    await nextTick()

    // Dropped shift is applied BEFORE waiting callbacks, so topReached does not fire again
    expect(el.scrollTop).toBe(4800)
    expect(wrapper.emitted('topReached')).toHaveLength(1)
    expect(wrapper.find('[data-id="40"]').exists()).toBe(true)
    expect(wrapper.get('.dou-virtual-list__spacer').attributes('style')).toBeUndefined()
    wrapper.unmount()
  })

  it('syncs virtual list scrollTop with ResizeObserver height growth to prevent cascade upward jumps', async () => {
    vi.useFakeTimers()
    const items = ref(make(0, 100))
    const wrapper = mount(
      defineComponent(
        () => () =>
          h(
            DouVirtualList,
            { items: items.value, itemKey: 'id', estimateSize: 120, height: 480, overscan: 4 },
            {
              default: ({ item }: { item: { id: number } }) =>
                h('div', { 'data-id': item.id }, `msg-${item.id}`),
            },
          ),
      ),
      { attachTo: document.body },
    )
    const el = wrapper.get('.dou-virtual-list').element as HTMLElement
    sized(el, { height: 30_000, client: 480 })
    let top = 4800
    let drop = false
    Object.defineProperty(el, 'scrollTop', {
      configurable: true,
      get: () => top,
      set: (value: number) => {
        if (!drop) top = value
      },
    })
    el.dispatchEvent(new Event('scroll'))
    await nextTick()

    // At scrollTop = 4800 (item 40), overscan = 4 renders items 36..47
    const initialIndices = wrapper
      .findAll('.dou-virtual-list__item')
      .map((node) => Number(node.attributes('data-index')))
    expect(initialIndices[0]).toBe(36)

    // 1. Desktop / accepted write: items 36..39 actually measure 320px (+200px each = +800px)
    //    No scroll event is dispatched after ResizeObserver, yet range must NOT pull in items < 36.
    for (const node of wrapper.findAll('.dou-virtual-list__item')) {
      const idx = Number(node.attributes('data-index'))
      Object.defineProperty(node.element, 'offsetHeight', {
        configurable: true,
        get: () => (idx >= 36 && idx <= 39 ? 320 : 120),
      })
    }
    resizeAll()
    await nextTick()
    expect(top).toBe(5600)
    const afterDesktopIndices = wrapper
      .findAll('.dou-virtual-list__item')
      .map((node) => Number(node.attributes('data-index')))
    expect(afterDesktopIndices[0]).toBe(36)

    // 2. iOS touch scroll where scrollTop write is dropped:
    //    User swipes up by 120px so item 35 enters overscan and measures 320px (+200px).
    drop = true
    touch('touchstart')
    top = 5480
    el.dispatchEvent(new Event('scroll'))
    await nextTick()
    const item35 = wrapper.find('.dou-virtual-list__item[data-index="35"]')
    expect(item35.exists()).toBe(true)
    Object.defineProperty(item35.element, 'offsetHeight', {
      configurable: true,
      get: () => 320,
    })
    resizeAll()
    await nextTick()

    // DOM scrollTop was dropped by iOS, but logical scrollTop & visual offset stayed in sync
    // so item 34 is NOT pulled in as a cascade.
    expect(top).toBe(5480)
    const duringTouchIndices = wrapper
      .findAll('.dou-virtual-list__item')
      .map((node) => Number(node.attributes('data-index')))
    expect(duringTouchIndices[0]).toBe(35)
    expect(wrapper.get('.dou-virtual-list__spacer').attributes('style')).toContain(
      'translateY(-200px)',
    )

    // When touch settles, the dropped +200px shift is applied cleanly
    touch('touchend')
    drop = false
    vi.advanceTimersByTime(200)
    await nextTick()
    expect(top).toBe(5680)
    expect(wrapper.get('.dou-virtual-list__spacer').attributes('style')).toBeUndefined()
    wrapper.unmount()
  })

  it('applies dropped shift before settled callbacks even when step is unknown during top scroll', async () => {
    vi.useFakeTimers()
    const items = ref(make(40, 60))
    const wrapper = mount(
      defineComponent({
        emits: ['topReached'],
        setup(_, { emit }) {
          return () =>
            h(
              DouChatList,
              {
                items: items.value,
                itemKey: 'id',
                estimateSize: 120,
                onTopReached: () => emit('topReached'),
              },
              {
                item: ({ item }: { item: { id: number } }) =>
                  h('div', { 'data-id': item.id }, `#${item.id}`),
              },
            )
        },
      }),
      { attachTo: document.body },
    )
    const el = wrapper.get('.dou-virtual-list').element as HTMLElement
    sized(el, { height: 20_000, client: 480 })
    let top = 0
    Object.defineProperty(el, 'scrollTop', {
      configurable: true,
      get: () => top,
      set: (value: number) => {
        top = value
      },
    })
    const scrollTo = (value: number) => {
      top = value
      el.dispatchEvent(new Event('scroll'))
    }

    // Reach top once
    scrollTo(120)
    scrollTo(0)
    expect(wrapper.emitted('topReached')).toHaveLength(1)

    // Touch starts with NO prior step in this touch (shift.step === undefined).
    // User leaves top briefly (resets atTop = false) then returns to 0.
    touch('touchstart')
    scrollTo(20)
    // Prepend 1 small item (+120px): iOS accepts write temporarily, then overwrites back to 0
    items.value = [...make(39, 1), ...items.value]
    await nextTick()
    await nextTick()
    expect(top).toBe(140)
    // iOS overwrites back to 0 on the very first scroll event after the shift.
    // Because delta is small (120px) and step is unknown, checkShift waits for
    // a second event while DouChatList.onScroll queues reachTop in waiting.
    scrollTo(0)
    touch('touchend')
    vi.advanceTimersByTime(200)
    await nextTick()

    // On settle, resolveShifts + makeLost must restore scrollTop BEFORE reachTop runs
    expect(top).toBe(120)
    expect(wrapper.emitted('topReached')).toHaveLength(1)
    wrapper.unmount()
  })

  it('clears pendingShift in DouChatList follow() before auto-scrolling to bottom', async () => {
    vi.useFakeTimers()
    let touchScroll!: ReturnType<typeof useTouchScroll>
    const wrapper = mount(
      defineComponent({
        setup() {
          touchScroll = useTouchScroll()
          return () => h(DouChatList, null, { default: () => h('p', '消息') })
        },
      }),
      { attachTo: document.body },
    )
    const el = wrapper.get('.dou-chat-list__viewport').element as HTMLElement
    sized(el, { height: 2000, client: 400 })
    let top = 1600
    let drop = true
    Object.defineProperty(el, 'scrollTop', {
      configurable: true,
      get: () => top,
      set: (value: number) => {
        if (!drop) top = value
      },
    })

    // Start at bottom (following = true), then an item above grows by 150px during touch
    el.dispatchEvent(new Event('scroll'))
    touch('touchstart')
    sized(el, { height: 2150, client: 400 })
    touchScroll.shiftScroll(el, 150)
    await nextTick()
    expect(touchScroll.pendingShift(el)).toBe(150)
    expect(wrapper.get('.dou-chat-list__content').attributes('style')).toContain(
      'translateY(-150px)',
    )

    // New content grows while following = true -> follow() clears pendingShift before scrolling
    drop = false
    sized(el, { height: 2200, client: 400 })
    resizeAll()
    await nextTick()
    expect(touchScroll.pendingShift(el)).toBe(0)
    expect(wrapper.get('.dou-chat-list__content').attributes('style')).toBeUndefined()
    expect(top).toBe(2200)

    touch('touchend')
    vi.advanceTimersByTime(200)
    expect(top).toBe(2200)
    wrapper.unmount()
  })

  it('accounts for pendingShift in DouChatList scrollToMessage(element) for start and nearest alignments', async () => {
    vi.useFakeTimers()
    let touchScroll!: ReturnType<typeof useTouchScroll>
    const chatRef = ref<{
      scrollToMessage: (target: Element, align?: 'start' | 'center' | 'end' | 'nearest') => void
    }>()
    const wrapper = mount(
      defineComponent({
        setup() {
          touchScroll = useTouchScroll()
          return () =>
            h(
              DouChatList,
              { ref: chatRef },
              {
                default: () => [h('p', { id: 'msg-a' }, 'A'), h('p', { id: 'msg-b' }, 'B')],
              },
            )
        },
      }),
      { attachTo: document.body },
    )
    const el = wrapper.get('.dou-chat-list__viewport').element as HTMLElement
    const target = wrapper.get('#msg-b').element as HTMLElement
    sized(el, { height: 5000, client: 400 })
    let top = 100
    let drop = true
    Object.defineProperty(el, 'scrollTop', {
      configurable: true,
      get: () => top,
      set: (value: number) => {
        if (!drop) top = value
      },
    })

    // Create a dropped pendingShift of +600px: content has translateY(-600px)
    touch('touchstart')
    touchScroll.shiftScroll(el, 600)
    await nextTick()
    expect(touchScroll.pendingShift(el)).toBe(600)

    // Layout offset of #msg-b is 1000px (height 50px).
    // With scrollTop = 100 and translateY(-600px), its visual top is 1000 - 100 - 600 = 300px (inside 0..400).
    el.getBoundingClientRect = () =>
      ({ top: 0, bottom: 400, height: 400, left: 0, right: 400, width: 400 }) as DOMRect
    target.getBoundingClientRect = () =>
      ({ top: 300, bottom: 350, height: 50, left: 0, right: 400, width: 400 }) as DOMRect

    // 1. align = 'nearest' when already visible: clearing translateY(-600px) must keep visual position -> scrollTop = 100 + 600 = 700
    drop = false
    chatRef.value!.scrollToMessage(target, 'nearest')
    expect(touchScroll.pendingShift(el)).toBe(0)
    expect(top).toBe(700)

    // 2. align = 'start' with another pendingShift of +500px:
    //    scrollTop = 100, pending = 500, layout offset = 1000 -> visual top = 1000 - 100 - 500 = 400
    top = 100
    drop = true
    touchScroll.shiftScroll(el, 500)
    await nextTick()
    expect(touchScroll.pendingShift(el)).toBe(500)
    target.getBoundingClientRect = () =>
      ({ top: 400, bottom: 450, height: 50, left: 0, right: 400, width: 400 }) as DOMRect
    drop = false
    chatRef.value!.scrollToMessage(target, 'start')
    expect(touchScroll.pendingShift(el)).toBe(0)
    expect(top).toBe(1000)

    touch('touchend')
    vi.advanceTimersByTime(200)
    wrapper.unmount()
  })
})

describe('right to left', () => {
  it('reads and follows positions in the browser’s own terms', () => {
    const a = document.createElement('div')
    const b = document.createElement('div')
    for (const el of [a, b]) {
      el.style.direction = 'rtl'
      document.body.append(el)
      sized(el, { width: 1000 })
      position(el)
    }
    a.scrollLeft = -300
    expect(scrollPositionOf(a).left).toBe(-300)
    a.scrollLeft = 20
    expect(scrollPositionOf(a).left).toBe(0)
    a.scrollLeft = -950
    expect(scrollPositionOf(a).left).toBe(-900)
    a.scrollLeft = -300
    createScrollLink('x').follow(a, b)
    expect(b.scrollLeft).toBe(-300)
  })
})
