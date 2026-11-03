import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, nextTick, ref, shallowRef } from 'vue'
import { resolveCalendar } from '../core/calendar'
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

function setup() {
  let axis!: ReturnType<typeof useTimeAxis>
  const { el, state } = iosScroller(() => axis?.totalWidth.value ?? 0)
  document.body.append(el)
  const wrapper = mount(
    defineComponent({
      setup() {
        axis = useTimeAxis({
          chart: shallowRef(el),
          tableBody: shallowRef(null),
          viewWidth: ref(800),
          scale: ref('day'),
          range: () => undefined,
          today: () => false,
          weekStart: computed(() => 1),
          calendar: computed(() => resolveCalendar()),
          messages: computed(() => ganttLocales['zh-CN']!),
          content: computed(() => ({
            start: parseTime('2026-03-02')!.at,
            end: parseTime('2026-03-20')!.at,
          })),
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
  return { wrapper, axis, state, scroll, shownStart, el }
}

const touch = (type: string) =>
  document.dispatchEvent(
    Object.assign(new Event(type, { bubbles: true }), {
      touches: type === 'touchstart' ? [{}] : [],
    }),
  )

afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ''
})

describe('time axis on iOS', () => {
  it('leaves room before the view for a run of swipes', async () => {
    vi.useFakeTimers()
    const { wrapper, axis, state, scroll, shownStart } = setup()
    await nextTick()
    const origin = axis.origin.value
    const room = axis.scrollLeft.value
    expect(room).toBeGreaterThanOrEqual(80 * 800 - 800)
    // swipe back thirty screens; writes are dropped meanwhile
    touch('touchstart')
    state.dropWrites = true
    for (let left = room; left > room - 30 * 800; left -= 400) await scroll(left)
    touch('touchend')
    // the start never came near, and nothing moved under the finger
    expect(axis.origin.value).toBe(origin)
    expect(axis.scrollLeft.value).toBeGreaterThan(5 * 800)
    const at = shownStart()
    // once the scroll is over, the room is made up again and the view stays put
    state.dropWrites = false
    vi.advanceTimersByTime(200)
    await nextTick()
    expect(axis.origin.value).toBeLessThan(origin)
    expect(shownStart()).toBeCloseTo(at, 3)
    expect(axis.scrollLeft.value).toBeGreaterThanOrEqual(80 * 800 - 800)
    vi.useRealTimers()
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
      left += 400
      expect(left + 800).toBeLessThan(axis.totalWidth.value)
      await scroll(left)
    }
    expect(axis.totalWidth.value).toBeGreaterThan(end)
    expect(axis.origin.value).toBe(origin)
    touch('touchend')
    wrapper.unmount()
  })

  it('makes up the room before the view right away without a finger', async () => {
    const { wrapper, axis, scroll, shownStart } = setup()
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
