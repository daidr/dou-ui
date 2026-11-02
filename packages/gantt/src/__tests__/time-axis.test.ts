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
  it('doesn’t jump back in time while the start bounces', async () => {
    vi.useFakeTimers()
    const { wrapper, axis, state, scroll, shownStart } = setup()
    await nextTick()
    const origin = axis.origin.value
    // drag to the start and past it; writes are dropped meanwhile
    touch('touchstart')
    state.dropWrites = true
    for (const left of [200, 80, 10, 0, -30, -60, -40]) await scroll(left)
    touch('touchend')
    for (const left of [-20, -5, 0]) await scroll(left)
    // nothing grew while the start bounced, so nothing has to move
    expect(axis.origin.value).toBe(origin)
    expect(shownStart()).toBe(origin)
    // once the scroll is over, time is added before the start and the view stays put
    state.dropWrites = false
    vi.advanceTimersByTime(200)
    await nextTick()
    expect(axis.origin.value).toBeLessThan(origin)
    expect(shownStart()).toBeCloseTo(origin, 3)
    wrapper.unmount()
  })

  it('adds time before the start right away without a finger', async () => {
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
