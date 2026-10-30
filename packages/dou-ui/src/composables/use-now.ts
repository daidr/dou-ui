import { getCurrentInstance, onMounted, onScopeDispose, readonly, ref, toValue, watch } from 'vue'
import type { MaybeRefOrGetter, Ref } from 'vue'

export interface UseNowOptions {
  /**
   * How long to wait before the next update, in ms. Defaults to 1000. Read
   * again after every update, so a getter can wait longer while nothing
   * on screen would change.
   */
  interval?: MaybeRefOrGetter<number>
}

/**
 * The current time as a timestamp, kept up to date. Ticks only in the
 * browser: on the server it stays at the moment it was created.
 */
export function useNow(options: UseNowOptions = {}): Readonly<Ref<number>> {
  const now = ref(Date.now())
  let timer: ReturnType<typeof setTimeout> | undefined
  let started = false
  let stopped = false

  function schedule() {
    if (stopped) return
    clearTimeout(timer)
    // setTimeout overflows above 2^31 - 1 ms; an hour is plenty between checks anyway
    const delay = Math.min(Math.max(toValue(options.interval) ?? 1000, 16), 3_600_000)
    timer = setTimeout(() => {
      now.value = Date.now()
      schedule()
    }, delay)
  }

  function start() {
    started = true
    now.value = Date.now()
    schedule()
  }

  // a new interval takes effect right away, not after the old wait runs out
  watch(
    () => toValue(options.interval),
    () => started && schedule(),
  )

  if (typeof window !== 'undefined') {
    if (getCurrentInstance()) onMounted(start)
    else start()
  }
  onScopeDispose(() => {
    stopped = true
    clearTimeout(timer)
  })
  return readonly(now)
}
