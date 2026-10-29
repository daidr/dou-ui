import { mount } from '@vue/test-utils'
import { defineComponent, nextTick } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { breakpointWidth, breakpoints, useBreakpoints } from '../../index'
import type { UseBreakpointsReturn } from '../../index'

afterEach(() => vi.unstubAllGlobals())

/** A matchMedia stub whose viewport width can be changed. */
function stubViewport(initial: number) {
  let width = initial
  const queries: { min: number; listeners: Set<() => void>; matches: boolean }[] = []
  vi.stubGlobal(
    'matchMedia',
    vi.fn<(query: string) => unknown>((query) => {
      const min = Number(/min-width:\s*(\d+)/.exec(query)?.[1] ?? 0)
      const listeners = new Set<() => void>()
      const entry = {
        min,
        listeners,
        get matches() {
          return width >= min
        },
        addEventListener: (_: string, fn: () => void) => listeners.add(fn),
        removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
      }
      queries.push(entry)
      return entry
    }),
  )
  return {
    queries,
    resize(next: number) {
      width = next
      for (const query of queries) for (const fn of query.listeners) fn()
    },
  }
}

function probe() {
  let screen!: UseBreakpointsReturn
  const Probe = defineComponent({
    setup() {
      screen = useBreakpoints()
      return () => null
    },
  })
  return { Probe, read: () => screen }
}

describe('useBreakpoints', () => {
  it('reads the viewport after mounting and follows it', async () => {
    const viewport = stubViewport(800)
    const { Probe, read } = probe()
    const wrapper = mount(Probe)
    await nextTick()
    expect(read()).toMatchObject({ sm: true, md: true, lg: false, xl: false, current: 'md' })
    viewport.resize(1300)
    expect(read().current).toBe('xl')
    viewport.resize(320)
    expect(read()).toMatchObject({ sm: false, current: 'base' })
    wrapper.unmount()
    expect(viewport.queries.every((query) => query.listeners.size === 0)).toBe(true)
  })

  it('matches the theme breakpoints', () => {
    expect(breakpointWidth('lg')).toBe(breakpoints.lg)
    expect(breakpointWidth(900)).toBe(900)
  })
})
