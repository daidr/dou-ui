import { computed, getCurrentInstance, onMounted, onScopeDispose, ref, toValue, watch } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

export interface UseCountdownOptions {
  /** Tick every this many ms instead of on each whole second, e.g. to show tenths. */
  interval?: MaybeRefOrGetter<number | undefined>
  onFinish?: () => void
}

/**
 * The time left until `target`, in ms, kept up to date. Ticks land on
 * whole seconds of what is left, so a display of seconds never skips one.
 */
export function useCountdown(
  target: MaybeRefOrGetter<number | Date | undefined | null>,
  options: UseCountdownOptions = {},
) {
  const end = computed(() => {
    const value = toValue(target)
    return value === undefined || value === null ? undefined : Number(value)
  })
  const left = (now: number) => (end.value === undefined ? 0 : Math.max(0, end.value - now))
  const remaining = ref(0)
  let timer: ReturnType<typeof setTimeout> | undefined

  function tick() {
    clearTimeout(timer)
    timer = undefined
    if (typeof window === 'undefined') return
    const next = left(Date.now())
    remaining.value = next
    if (next <= 0) {
      if (end.value !== undefined) options.onFinish?.()
      return
    }
    const step = toValue(options.interval)
    const wait = step ? Math.min(step, next) : next % 1000 || 1000
    timer = setTimeout(tick, wait)
  }

  watch([end, () => toValue(options.interval)], tick)
  // Inside a component, start once mounted so the first render matches the server's.
  if (getCurrentInstance()) onMounted(tick)
  else tick()
  onScopeDispose(() => clearTimeout(timer))

  return {
    /** What is left, in ms. */
    remaining,
    done: computed(() => remaining.value <= 0),
  }
}
