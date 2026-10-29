import { computed, onBeforeUnmount, onMounted, onScopeDispose, ref, toValue, watch } from 'vue'
import type { ComputedRef, MaybeRefOrGetter } from 'vue'
import { useGlobalConfig } from '../components/config-provider/use-config'

/**
 * How much the page animates.
 *
 * - `auto`: follow the system's reduced-motion setting;
 * - `reduce`: no travel or scaling, short fades only;
 * - `none`: no animation at all.
 */
export type MotionMode = 'auto' | 'reduce' | 'none'

export type MotionDuration = 'instant' | 'fast' | 'normal' | 'slow'

const ATTRIBUTE = 'data-dou-motion'

function pageMode(): MotionMode {
  if (typeof document === 'undefined') return 'auto'
  const value = document.documentElement.getAttribute(ATTRIBUTE)
  return value === 'reduce' || value === 'none' ? value : 'auto'
}

/** Set the page's motion mode; `auto` removes the attribute. */
export function setMotionMode(mode: MotionMode) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (mode === 'auto') root.removeAttribute(ATTRIBUTE)
  else root.setAttribute(ATTRIBUTE, mode)
}

/**
 * Apply `mode` to the page while the calling component is mounted, and put
 * back what was there before when it unmounts. `undefined` leaves the page
 * alone.
 */
export function useMotionMode(mode: MaybeRefOrGetter<MotionMode | undefined>) {
  let previous: string | null = null
  let applied = false
  onMounted(() => {
    previous = document.documentElement.getAttribute(ATTRIBUTE)
    watch(
      () => toValue(mode),
      (value) => {
        if (!value) return
        applied = true
        setMotionMode(value)
      },
      { immediate: true },
    )
  })
  onBeforeUnmount(() => {
    if (!applied) return
    if (previous === null) document.documentElement.removeAttribute(ATTRIBUTE)
    else document.documentElement.setAttribute(ATTRIBUTE, previous)
  })
}

/**
 * Whether motion should be reduced: the configured `motion` mode, the
 * page's `data-dou-motion` attribute, or else the system setting. Use it
 * for motion driven from script, such as smooth scrolling.
 */
export function useReducedMotion(): ComputedRef<boolean> {
  const config = useGlobalConfig()
  const prefersReduced = ref(false)

  if (typeof window !== 'undefined' && window.matchMedia) {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    prefersReduced.value = query.matches
    const onChange = (event: MediaQueryListEvent) => (prefersReduced.value = event.matches)
    query.addEventListener?.('change', onChange)
    onScopeDispose(() => query.removeEventListener?.('change', onChange))
  }

  return computed(() => {
    const configured = config.value.motion
    const mode = configured && configured !== 'auto' ? configured : pageMode()
    return mode === 'auto' ? prefersReduced.value : true
  })
}

/**
 * The current value of a duration token in milliseconds, as resolved on
 * `element` (the page root by default), so it reflects custom themes and
 * reduced-motion settings.
 */
export function getMotionDuration(name: MotionDuration, element?: Element): number {
  if (typeof document === 'undefined') return 0
  const value = getComputedStyle(element ?? document.documentElement)
    .getPropertyValue(`--dou-motion-duration-${name}`)
    .trim()
  const amount = Number.parseFloat(value)
  if (Number.isNaN(amount)) return 0
  return value.endsWith('ms') ? amount : amount * 1000
}
