import { computed, onBeforeUnmount, shallowRef } from 'vue'
import { createOffsets } from '../components/virtual-list/virtual-list'
import { scrollPositionOf } from '../utils/scroll'
import { useTouchScroll } from './use-touch-scroll'

export interface UseMeasuredSizesOptions<K> {
  /** How many items there are. */
  count: () => number
  /** A key that follows an item as the list changes. */
  keyOf: (index: number) => K
  /** The height to assume for an item not measured yet. */
  estimate: (index: number) => number
  /** The element that scrolls, kept steady while items above the view change height. */
  container: () => HTMLElement | null | undefined
}

/**
 * Item offsets for a list whose items are measured once rendered.
 *
 * Unmeasured items count at their estimate. Rendered items are watched for
 * size changes; when one above the top of the view changes, the scroll
 * position moves by the same amount, so what the reader sees stays put.
 * Not during a touch scroll: iOS drops the move, or fights the momentum
 * with it.
 */
export function useMeasuredSizes<K>(options: UseMeasuredSizesOptions<K>) {
  const known = new Map<K, number>()
  const touch = useTouchScroll()
  // Bumped when a measurement changes; reading it ties offsets to it.
  const version = shallowRef(0)

  const sizeOf = (index: number) => known.get(options.keyOf(index)) ?? options.estimate(index)
  const offsets = computed(() => {
    void version.value
    return createOffsets(options.count(), sizeOf)
  })

  // An item can span several elements, e.g. a table row and its detail row.
  const tracked = new Map<Element, { key: K; index: number }>()
  const byKey = new Map<K, Set<Element>>()
  const heightOf = (key: K) => {
    let size = 0
    for (const element of byKey.get(key) ?? []) size += (element as HTMLElement).offsetHeight
    return size
  }

  /** Record new heights for `keys`, keeping the view steady above the top. */
  function update(items: Iterable<{ key: K; index: number }>) {
    let shift = 0
    let changed = false
    const el = options.container()
    const top = el ? scrollPositionOf(el).top : 0
    const seen = new Set<K>()
    for (const { key, index } of items) {
      if (seen.has(key)) continue
      seen.add(key)
      const size = heightOf(key)
      const before = sizeOf(index)
      if (size === before && known.has(key)) continue
      known.set(key, size)
      changed = true
      if (offsets.value.start(index) < top) shift += size - before
    }
    if (!changed) return
    version.value++
    if (el && shift && !touch.active()) el.scrollTop = top + shift
  }

  const observer =
    typeof ResizeObserver === 'undefined'
      ? undefined
      : new ResizeObserver((entries) =>
          update(entries.flatMap((entry) => tracked.get(entry.target) ?? [])),
        )

  /** Watch an item's element; call it from a function ref on every render. */
  function track(element: Element | null, key: K, index: number) {
    if (!element) return
    const item = tracked.get(element)
    if (item) {
      if (item.key !== key) {
        byKey.get(item.key)?.delete(element)
        item.key = key
        add(element, key)
      }
      item.index = index
      return
    }
    tracked.set(element, { key, index })
    add(element, key)
    observer?.observe(element)
  }
  function add(element: Element, key: K) {
    let set = byKey.get(key)
    if (!set) byKey.set(key, (set = new Set()))
    set.add(element)
  }
  /** Stop watching elements that left the page, and re-measure what they belonged to. */
  function prune() {
    const touched: { key: K; index: number }[] = []
    for (const [element, item] of tracked) {
      if (element.isConnected) continue
      observer?.unobserve(element)
      tracked.delete(element)
      const set = byKey.get(item.key)
      set?.delete(element)
      // Only re-measure an item still on the page, e.g. a row whose detail closed.
      if (set?.size) touched.push(item)
      else byKey.delete(item.key)
    }
    if (touched.length) update(touched)
  }
  onBeforeUnmount(() => observer?.disconnect())

  return { offsets, sizeOf, track, prune }
}
