import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useElementSize, useIntersection, useResizeObserver } from '../use-element-size'

type Callback = (entries: unknown[]) => void
const resize: { callback: Callback; observed: Element[]; disconnected: boolean }[] = []
const intersect: {
  callback: Callback
  options: IntersectionObserverInit
  observed: Element[]
  disconnected: boolean
}[] = []

beforeEach(() => {
  resize.length = 0
  intersect.length = 0
  vi.stubGlobal(
    'ResizeObserver',
    class {
      record = { callback: (() => {}) as Callback, observed: [] as Element[], disconnected: false }
      constructor(callback: Callback) {
        this.record.callback = callback
        resize.push(this.record)
      }
      observe(el: Element) {
        this.record.observed.push(el)
      }
      disconnect() {
        this.record.disconnected = true
      }
    },
  )
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      record
      constructor(callback: Callback, options: IntersectionObserverInit) {
        this.record = { callback, options, observed: [] as Element[], disconnected: false }
        intersect.push(this.record)
      }
      observe(el: Element) {
        this.record.observed.push(el)
      }
      disconnect() {
        this.record.disconnected = true
      }
    },
  )
})
afterEach(() => vi.unstubAllGlobals())

describe('useResizeObserver', () => {
  it('follows the elements and stops when the scope ends', async () => {
    const calls: number[] = []
    const shown = ref(true)
    const wrapper = mount(
      defineComponent(() => {
        const a = ref<HTMLElement | null>(null)
        const b = ref<HTMLElement | null>(null)
        useResizeObserver(
          () => [a.value, b.value],
          () => calls.push(1),
        )
        return () => [h('div', { ref: a }), shown.value ? h('div', { ref: b }) : null]
      }),
    )
    await nextTick()
    expect(resize.at(-1)!.observed).toHaveLength(2)
    resize.at(-1)!.callback([])
    expect(calls).toHaveLength(1)
    shown.value = false
    await nextTick()
    await nextTick()
    expect(resize[0]!.disconnected).toBe(true)
    expect(resize.at(-1)!.observed).toHaveLength(1)
    wrapper.unmount()
    expect(resize.at(-1)!.disconnected).toBe(true)
  })
})

describe('useElementSize', () => {
  it('reads the box sizes reported by the observer', async () => {
    let size!: ReturnType<typeof useElementSize>
    mount(
      defineComponent(() => {
        const el = ref<HTMLElement | null>(null)
        size = useElementSize(el, { initial: { width: 10, height: 20 } })
        return () => h('div', { ref: el })
      }),
    )
    await nextTick()
    resize
      .at(-1)!
      .callback([{ contentBoxSize: [{ inlineSize: 320, blockSize: 48 }], contentRect: {} }])
    expect(size.width.value).toBe(320)
    expect(size.height.value).toBe(48)
  })
})

describe('useIntersection', () => {
  it('reports visibility and stops after the first time with once', async () => {
    let state!: ReturnType<typeof useIntersection>
    mount(
      defineComponent(() => {
        const el = ref<HTMLElement | null>(null)
        state = useIntersection(el, { rootMargin: '200px 0px', threshold: [0, 1], once: true })
        return () => h('div', { ref: el })
      }),
    )
    await nextTick()
    const record = intersect.at(-1)!
    expect(record.options.rootMargin).toBe('200px 0px')
    expect(record.options.threshold).toEqual([0, 1])
    record.callback([{ isIntersecting: false, intersectionRatio: 0 }])
    expect(state.isIntersecting.value).toBe(false)
    expect(record.disconnected).toBe(false)
    record.callback([{ isIntersecting: true, intersectionRatio: 0.5 }])
    expect(state.isIntersecting.value).toBe(true)
    expect(state.ratio.value).toBe(0.5)
    expect(record.disconnected).toBe(true)
  })
})
