import type { Directive } from 'vue'
import type { InfiniteScrollDirectiveValue } from './infinite-scroll'
import { watchScrollEnd } from './scroll-end'

interface State {
  options: Exclude<InfiniteScrollDirectiveValue, () => unknown>
  watcher?: ReturnType<typeof watchScrollEnd>
}

const states = new WeakMap<HTMLElement, State>()

const normalize = (value: InfiniteScrollDirectiveValue) =>
  typeof value === 'function' ? { load: value } : value

/**
 * Call a function when an element is scrolled near its end. Put it on
 * the scrolling element itself; on one that does not scroll, it watches
 * the nearest scroll container (or the window) instead.
 *
 * ```vue
 * <ul v-infinite-scroll="loadMore" style="height: 320px; overflow: auto">…</ul>
 * <ul v-infinite-scroll="{ load: loadMore, disabled: done, distance: 200 }">…</ul>
 * ```
 */
export const vInfiniteScroll: Directive<HTMLElement, InfiniteScrollDirectiveValue> = {
  mounted(el, binding) {
    const state: State = { options: normalize(binding.value) }
    states.set(el, state)
    state.watcher = watchScrollEnd({
      el,
      distance: () => state.options.distance ?? 100,
      active: () => !state.options.disabled,
      load: () => state.options.load(),
    })
    if (state.options.immediate !== false) void state.watcher.check()
  },
  updated(el, binding) {
    const state = states.get(el)
    if (!state || binding.value === binding.oldValue) return
    const wasDisabled = state.options.disabled
    state.options = normalize(binding.value)
    if (wasDisabled && !state.options.disabled) void state.watcher?.check()
  },
  beforeUnmount(el) {
    states.get(el)?.watcher?.stop()
    states.delete(el)
  },
  getSSRProps: () => ({}),
}
