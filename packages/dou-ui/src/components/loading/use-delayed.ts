import { onScopeDispose, ref, toValue, watch } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

/** Follow `source`, but only turn on after it has stayed on for `delay` ms. */
export function useDelayed(source: MaybeRefOrGetter<boolean>, delay: MaybeRefOrGetter<number>) {
  const active = ref(false)
  let timer: ReturnType<typeof setTimeout> | undefined
  const stop = () => {
    if (timer !== undefined) clearTimeout(timer)
    timer = undefined
  }
  watch(
    () => toValue(source),
    (on) => {
      stop()
      const wait = toValue(delay)
      if (!on || wait <= 0) active.value = on
      else timer = setTimeout(() => (active.value = true), wait)
    },
    { immediate: true },
  )
  onScopeDispose(stop)
  return active
}
