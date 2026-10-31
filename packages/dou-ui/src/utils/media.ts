import { breakpoints } from '@dou-ui/theme'
import { onMounted, onScopeDispose, ref } from 'vue'
import type { Ref } from 'vue'

/**
 * Whether a media query matches. Starts `false` and is read after mounting,
 * so server-rendered markup matches the first client render.
 */
export function useMediaQuery(query: string): Readonly<Ref<boolean>> {
  const matches = ref(false)
  let cleanup: (() => void) | undefined
  onMounted(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const list = window.matchMedia(query)
    const sync = () => (matches.value = list.matches)
    sync()
    list.addEventListener?.('change', sync)
    cleanup = () => list.removeEventListener?.('change', sync)
  })
  onScopeDispose(() => cleanup?.())
  return matches
}

/** Whether the viewport is narrower than the `sm` breakpoint: a phone held upright. */
export const useNarrowViewport = () => useMediaQuery(`(max-width: ${breakpoints.sm - 0.02}px)`)

/**
 * Whether the main pointer is a finger. Pickers then keep the on-screen
 * keyboard closed, since their panel is the easier way to choose.
 */
export const useCoarsePointer = () => useMediaQuery('(pointer: coarse)')
