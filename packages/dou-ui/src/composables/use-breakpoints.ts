import { breakpoints } from '@dou-ui/theme'
import type { Breakpoint } from '@dou-ui/theme'
import { computed, onMounted, onScopeDispose, reactive } from 'vue'
import type { ComputedRef } from 'vue'

export interface UseBreakpointsReturn {
  /** Whether the viewport is at least as wide as each breakpoint. */
  readonly sm: boolean
  readonly md: boolean
  readonly lg: boolean
  readonly xl: boolean
  /** The largest breakpoint the viewport reaches, or `base` below `sm`. */
  readonly current: 'base' | Breakpoint
}

const names = Object.keys(breakpoints) as Breakpoint[]

/** The px width of a breakpoint name, or the number itself. */
export const breakpointWidth = (value: number | Breakpoint) =>
  typeof value === 'number' ? value : breakpoints[value]

/**
 * Follow the viewport against the breakpoints shared with Grid and the
 * theme. Every flag starts `false` and `current` starts at `base`, and they
 * are read after mounting, so server-rendered markup matches the first
 * client render.
 */
export function useBreakpoints(): UseBreakpointsReturn {
  const state = reactive<Record<Breakpoint, boolean>>({
    sm: false,
    md: false,
    lg: false,
    xl: false,
  })
  const current: ComputedRef<'base' | Breakpoint> = computed(() => {
    let result: 'base' | Breakpoint = 'base'
    for (const name of names) if (state[name]) result = name
    return result
  })

  const cleanups: (() => void)[] = []
  onMounted(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    for (const name of names) {
      const query = window.matchMedia(`(min-width: ${breakpoints[name]}px)`)
      const sync = () => (state[name] = query.matches)
      sync()
      query.addEventListener?.('change', sync)
      cleanups.push(() => query.removeEventListener?.('change', sync))
    }
  })
  onScopeDispose(() => {
    for (const cleanup of cleanups) cleanup()
  })

  return reactive({
    sm: computed(() => state.sm),
    md: computed(() => state.md),
    lg: computed(() => state.lg),
    xl: computed(() => state.xl),
    current,
  }) as UseBreakpointsReturn
}
