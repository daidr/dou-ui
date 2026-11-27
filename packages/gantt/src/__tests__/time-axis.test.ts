import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, nextTick, ref, shallowRef } from 'vue'
import { resolveCalendar } from '../core/calendar'
import type { GanttScale } from '../core/scale'
import { parseTime } from '../core/time'
import { ganttLocales } from '../locale'
import { useTimeAxis } from '../time-axis'

/**
 * A timeline that scrolls like one on iOS: while a finger is down, or the
 * momentum and the bounce at the end go on, positions written to it are
 * dropped, and it reports positions past either end.
 */
function iosScroller(total: () => number, width = 800) {
  const el = document.createElement('div')
  const state = { left: 0, dropWrites: false }
  Object.defineProperties(el, {
    clientWidth: { get: () => width },
    scrollWidth: { get: () => Math.max(total(), width) },
    scrollLeft: {
      get: () => state.left,
      set: (value: number) => {
        if (!state.dropWrites)
          state.left = Math.min(Math.max(value, 0), Math.max(0, total() - width))
      },
    },
  })
  return { el, state }
}

/** A timeline on a touch screen, or with `coarse` false, one with a mouse. */
function setup(
  scale: GanttScale = 'day',
  coarse = true,
  options?: { follow?: boolean; today?: boolean },
) {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: coarse, media: query }))
  let axis!: ReturnType<typeof useTimeAxis>
  const { el, state } = iosScroller(() => axis?.totalWidth.value ?? 0)
  document.body.append(el)
  const content = ref({ start: parseTime('2026-03-02')!.at, end: parseTime('2026-03-20')!.at })
  const follow = ref(options?.follow ?? false)
  const scaleRef = ref<GanttScale | undefined>(scale)
  const wrapper = mount(
    defineComponent({
      setup() {
        axis = useTimeAxis({
          chart: shallowRef(el),
          tableBody: shallowRef(null),
          viewWidth: ref(800),
          scale: scaleRef,
          follow,
          range: () => undefined,
          today: () => options?.today ?? false,
          weekStart: computed(() => 1),
          calendar: computed(() => resolveCalendar()),
          messages: computed(() => ganttLocales['zh-CN']!),
          content: computed(() => content.value),
          fitWidth: () => 800,
        })
        return () => null
      },
    }),
    { attachTo: document.body },
  )
  /** The user moves the timeline to `left`, as the browser reports it. */
  const scroll = async (left: number) => {
    state.left = left
    axis.onChartScroll()
    await nextTick()
  }
  /** The time at the left edge of what's drawn. */
  const shownStart = () => axis.origin.value + axis.scrollLeft.value / axis.ppm.value
  return { wrapper, axis, state, scroll, shownStart, el, content, follow, scaleRef }
}

const touch = (type: string) =>
  document.dispatchEvent(
    Object.assign(new Event(type, { bubbles: true }), {
      touches: type === 'touchstart' ? [{}] : [],
    }),
  )

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('time axis on iOS', () => {
  it('leaves room before the view for a run of swipes', async () => {
    vi.useFakeTimers()
    const { wrapper, axis, state, scroll, shownStart } = setup()
    await nextTick()
    const origin = axis.origin.value
    const room = axis.scrollLeft.value
    expect(room).toBeGreaterThanOrEqual(300 * 800 - 800)
    // swipe back two hundred screens in a run of swipes that never lets the
    // momentum stop; writes are dropped meanwhile
    state.dropWrites = true
    let left = room
    for (let swipe = 0; swipe < 100; swipe++) {
      touch('touchstart')
      for (let i = 0; i < 4; i++) await scroll((left -= 400))
      touch('touchend')
      await scroll((left -= 400))
    }
    // the start never came near, and nothing moved under the finger
    expect(axis.origin.value).toBe(origin)
    expect(axis.scrollLeft.value).toBeGreaterThan(40 * 800)
    const at = shownStart()
    // once the scroll is over, the room is made up again and the view stays put
    state.dropWrites = false
    vi.advanceTimersByTime(200)
    await nextTick()
    expect(axis.origin.value).toBeLessThan(origin)
    expect(shownStart()).toBeCloseTo(at, 3)
    expect(axis.scrollLeft.value).toBeGreaterThanOrEqual(300 * 800 - 800)
    vi.useRealTimers()
    wrapper.unmount()
  })

  it('leaves the same room at the year scale', async () => {
    const { wrapper, axis, state, scroll } = setup('year')
    await nextTick()
    const origin = axis.origin.value
    const room = axis.scrollLeft.value
    expect(room).toBeGreaterThanOrEqual(300 * 800 - 800)
    state.dropWrites = true
    let left = room
    for (let swipe = 0; swipe < 100; swipe++) {
      touch('touchstart')
      for (let i = 0; i < 4; i++) await scroll((left -= 400))
      touch('touchend')
      await scroll((left -= 400))
    }
    expect(axis.origin.value).toBe(origin)
    expect(axis.scrollLeft.value).toBeGreaterThan(40 * 800)
    wrapper.unmount()
  })

  it('adds time after the end as you scroll, finger down or not', async () => {
    const { wrapper, axis, state, scroll } = setup()
    await nextTick()
    const origin = axis.origin.value
    touch('touchstart')
    state.dropWrites = true
    let left = axis.scrollLeft.value
    const end = axis.totalWidth.value
    // forty screens on, without ever reaching the end
    for (let i = 0; i < 80; i++) {
      await scroll((left += 400))
      // always a few screens ahead
      expect(axis.totalWidth.value - left - 800).toBeGreaterThanOrEqual(3 * 800)
    }
    expect(axis.totalWidth.value).toBeGreaterThan(end)
    expect(axis.origin.value).toBe(origin)
    touch('touchend')
    wrapper.unmount()
  })

  it('keeps the view in place when content comes in earlier during a touch scroll', async () => {
    vi.useFakeTimers()
    const { wrapper, axis, state, scroll, shownStart, content } = setup()
    await nextTick()
    const origin = axis.origin.value
    touch('touchstart')
    state.dropWrites = true
    await scroll(axis.scrollLeft.value - 400)
    const at = shownStart()
    // a task a year earlier comes in, as from someone else editing the plan
    content.value = { ...content.value, start: content.value.start - 365 * 24 * 60 }
    await nextTick()
    await scroll(axis.scrollLeft.value - 400)
    expect(axis.origin.value).toBe(origin)
    expect(shownStart()).toBeCloseTo(at - 400 / axis.ppm.value, 3)
    touch('touchend')
    const rest = shownStart()
    // once the scroll is over, the start moves out and the view stays put
    state.dropWrites = false
    vi.advanceTimersByTime(200)
    await nextTick()
    expect(axis.origin.value).toBeLessThan(origin - 300 * 24 * 60)
    expect(shownStart()).toBeCloseTo(rest, 3)
    vi.useRealTimers()
    wrapper.unmount()
  })

  it('keeps little room with a mouse, made up right away near the start', async () => {
    const { wrapper, axis, scroll, shownStart } = setup('day', false)
    await nextTick()
    // a few screens, so the scrollbar thumb still shows where the view is
    expect(axis.scrollLeft.value).toBeLessThan(5 * 800)
    await nextTick()
    const origin = axis.origin.value
    await scroll(100)
    await nextTick()
    expect(axis.origin.value).toBeLessThan(origin)
    expect(shownStart()).toBeCloseTo(origin + 100 / axis.ppm.value, 3)
    // a bounce at the start on a trackpad waits for the bounce to end
    const next = axis.origin.value
    await scroll(-40)
    expect(axis.origin.value).toBe(next)
    wrapper.unmount()
  })
})

describe('live monitoring time axis', () => {
  it('follows current time at 1s granularity and keeps now anchored near the right edge', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 2, 5, 15, 0, 0))
    const { wrapper, axis, follow } = setup('second', false, { follow: true, today: true })
    await nextTick()

    // followMargin = min(80, round(800 * 0.12)) = 80 => anchor at 720px from left edge
    expect(axis.todayX.value! - axis.scrollLeft.value).toBeCloseTo(720, 0)
    const beforeLeft = axis.scrollLeft.value

    // advance 10 seconds: at second scale (432_000 px/day = 5 px/s), scrollLeft advances ~50px
    vi.advanceTimersByTime(10_000)
    await nextTick()
    expect(follow.value).toBe(true)
    expect(axis.scrollLeft.value - beforeLeft).toBeGreaterThanOrEqual(45)
    expect(axis.todayX.value! - axis.scrollLeft.value).toBeCloseTo(720, 0)

    // zooming while following keeps follow active and now pinned at the anchor
    axis.zoomOut()
    await nextTick()
    expect(follow.value).toBe(true)
    expect(axis.todayX.value! - axis.scrollLeft.value).toBeCloseTo(720, 0)
    wrapper.unmount()
  })

  it('detaches follow on horizontal scroll/wheel/drag or scrollToDate, but not on vertical wheel', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 2, 5, 15, 0, 0))
    const { wrapper, axis, follow, scroll } = setup('minute', false, { follow: true, today: true })
    await nextTick()

    // vertical wheel keeps follow active
    axis.onWheel(new WheelEvent('wheel', { deltaY: 120, deltaX: 0 }))
    expect(follow.value).toBe(true)

    // horizontal wheel detaches follow
    axis.onWheel(new WheelEvent('wheel', { deltaX: -60, deltaY: 0 }))
    expect(follow.value).toBe(false)

    // re-enable follow, then shift+wheel detaches follow
    follow.value = true
    await nextTick()
    axis.onWheel(Object.assign(new WheelEvent('wheel', { deltaY: 60 }), { shiftKey: true }))
    expect(follow.value).toBe(false)

    // re-enable follow, then manual horizontal scroll detaches follow
    follow.value = true
    await nextTick()
    await scroll(axis.scrollLeft.value - 120)
    expect(follow.value).toBe(false)

    // re-enable follow, then scrollToDate detaches follow
    follow.value = true
    await nextTick()
    axis.scrollToDate('2026-03-05 14:30')
    expect(follow.value).toBe(false)

    // scrollToToday while following keeps follow on and aligns now to the right anchor
    follow.value = true
    await nextTick()
    axis.scrollToToday()
    await nextTick()
    expect(follow.value).toBe(true)
    expect(axis.todayX.value! - axis.scrollLeft.value).toBeCloseTo(720, 0)
    wrapper.unmount()
  })

  it('fits an explicit sub-hour window and preserves follow when trailing now', async () => {
    vi.useFakeTimers()
    const nowTs = new Date(2026, 2, 5, 15, 0, 0).getTime()
    vi.setSystemTime(nowTs)
    const { wrapper, axis, follow, scaleRef } = setup('hour', false, {
      follow: true,
      today: true,
    })
    await nextTick()

    // 15-minute trailing window while following => switches to minute scale and stays following
    axis.fit([nowTs - 15 * 60_000, nowTs])
    await nextTick()
    expect(scaleRef.value).toBe('minute')
    expect(follow.value).toBe(true)
    expect(axis.todayX.value! - axis.scrollLeft.value).toBeCloseTo(720, 0)

    // historical 2-minute window => switches to second scale and detaches follow
    axis.fit(['2026-03-05 12:00:00', '2026-03-05 12:02:00'])
    await nextTick()
    expect(scaleRef.value).toBe('second')
    expect(follow.value).toBe(false)
    wrapper.unmount()
  })

  it('pans horizontally by pointer drag and clamps second-scale totalWidth safely', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 2, 5, 15, 0, 0))
    const { wrapper, axis, follow, el } = setup('second', false, { follow: true, today: true })
    await nextTick()
    expect(axis.totalWidth.value).toBeLessThanOrEqual(8_100_000)

    const beforeLeft = axis.scrollLeft.value
    axis.startPan(
      new PointerEvent('pointerdown', {
        button: 0,
        pointerType: 'mouse',
        clientX: 400,
      }),
    )
    window.dispatchEvent(
      new PointerEvent('pointermove', {
        pointerType: 'mouse',
        clientX: 520,
      }),
    )
    expect(axis.panning.value).toBe(true)
    expect(axis.wasPanned()).toBe(true)
    expect(follow.value).toBe(false)
    expect(axis.scrollLeft.value).toBe(beforeLeft - 120)

    window.dispatchEvent(new PointerEvent('pointerup', { pointerType: 'mouse', clientX: 520 }))
    expect(axis.panning.value).toBe(false)
    vi.advanceTimersByTime(10)
    expect(axis.wasPanned()).toBe(false)

    // clicks on interactive descendants (e.g. marker buttons) do not start a pan
    const btn = document.createElement('button')
    el.append(btn)
    const down = new PointerEvent('pointerdown', {
      button: 0,
      pointerType: 'mouse',
      clientX: 400,
    })
    Object.defineProperty(down, 'target', { value: btn })
    axis.startPan(down)
    window.dispatchEvent(new PointerEvent('pointermove', { pointerType: 'mouse', clientX: 480 }))
    expect(axis.panning.value).toBe(false)
    wrapper.unmount()
  })
})
