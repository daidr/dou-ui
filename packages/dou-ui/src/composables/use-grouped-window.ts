import { computed, onBeforeUnmount, onMounted, onUpdated, ref, watch } from 'vue'
import { createOffsets } from '../components/virtual-list/virtual-list'
import { shouldVirtualize } from '../utils/virtual'

export interface UseGroupedWindowOptions {
  /** The element that scrolls. */
  container: () => HTMLElement | null | undefined
  /** How many items each group holds, in order. */
  sizes: () => number[]
  /** The height of an item in px. */
  itemSize: (group: number, index: number) => number
  /** `virtual` as asked for; left undefined, it turns on for long lists. */
  virtual: () => boolean | undefined
  /** Extra items rendered above and below the viewport. */
  overscan?: number
}

export interface GroupWindow {
  /** The first item to render. */
  from: number
  /** One past the last item to render. */
  to: number
  /** The height of a spacer standing in for the items before `from`. */
  before: number
  /** The height of a spacer standing in for the items from `to` on. */
  after: number
}

/** The attribute that marks where a group's items begin, on its leading spacer. */
export const GROUP_START = 'data-dou-group-start'

/**
 * Render only the items in view of a list split into groups, such as
 * options under group labels. Items keep their place in the page between
 * two spacers, so labels, separators and padding stay as they are; where
 * each group's items begin is measured from a marker on its leading spacer.
 */
export function useGroupedWindow(options: UseGroupedWindowOptions) {
  const overscan = options.overscan ?? 4
  const scrollTop = ref(0)
  const viewport = ref(0)
  const measuredStarts = ref<number[]>([])

  const total = computed(() => options.sizes().reduce((sum, count) => sum + count, 0))
  const enabled = computed(() => shouldVirtualize(options.virtual(), total.value))
  const offsets = computed(() =>
    options.sizes().map((count, group) => createOffsets(count, (i) => options.itemSize(group, i))),
  )
  // Until measured, groups are assumed to follow each other with no gap.
  const starts = computed(() => {
    let estimate = 0
    return offsets.value.map((offset, group) => {
      const start = measuredStarts.value[group] ?? estimate
      estimate = start + offset.total
      return start
    })
  })

  function windowOf(group: number): GroupWindow {
    const count = options.sizes()[group] ?? 0
    if (!enabled.value) return { from: 0, to: count, before: 0, after: 0 }
    const offset = offsets.value[group]!
    const top = scrollTop.value - starts.value[group]!
    const height = Math.max(viewport.value, 1)
    let from: number
    let to: number
    if (!count || top + height <= 0) from = to = 0
    else if (top >= offset.total) from = to = count
    else {
      from = Math.max(0, offset.find(Math.max(0, top)) - overscan)
      to = Math.min(count, offset.find(top + height - 1) + 1 + overscan)
    }
    return { from, to, before: offset.start(from), after: offset.total - offset.start(to) }
  }
  const windows = computed(() => options.sizes().map((_, group) => windowOf(group)))

  function measure() {
    const el = options.container()
    if (!el || !enabled.value) return
    viewport.value = el.clientHeight
    const base = el.getBoundingClientRect().top - el.scrollTop
    const markers = el.querySelectorAll(`[${GROUP_START}]`)
    const next = Array.from(markers, (marker) =>
      Math.round(marker.getBoundingClientRect().top - base),
    )
    const current = measuredStarts.value
    if (next.length !== current.length || next.some((value, at) => value !== current[at])) {
      measuredStarts.value = next
    }
  }

  function onScroll() {
    const el = options.container()
    if (el && enabled.value) scrollTop.value = el.scrollTop
  }

  /** Scroll as little as needed to show an item, whether or not it is rendered. */
  function scrollToItem(group: number, index: number) {
    const el = options.container()
    const offset = offsets.value[group]
    if (!el || !offset) return
    const top = starts.value[group]! + offset.start(index)
    const bottom = starts.value[group]! + offset.start(index + 1)
    let target = el.scrollTop
    if (top < target) target = top
    else if (bottom > target + el.clientHeight) target = bottom - el.clientHeight
    if (target !== el.scrollTop) {
      el.scrollTop = Math.max(0, target)
      scrollTop.value = el.scrollTop
    }
  }

  let observed: HTMLElement | null | undefined
  let observer: ResizeObserver | undefined
  function bind() {
    const el = options.container()
    if (el === observed) return
    observed?.removeEventListener('scroll', onScroll)
    observer?.disconnect()
    observed = el
    if (!el) return
    el.addEventListener('scroll', onScroll, { passive: true })
    scrollTop.value = el.scrollTop
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(measure)
      observer.observe(el)
    }
  }
  onMounted(() => {
    bind()
    measure()
  })
  onUpdated(() => {
    bind()
    measure()
  })
  watch(enabled, (on) => {
    if (on) onScroll()
  })
  onBeforeUnmount(() => {
    observed?.removeEventListener('scroll', onScroll)
    observer?.disconnect()
  })

  /** Where an item starts in the scrolled content. */
  const startOf = (group: number, index: number) =>
    (starts.value[group] ?? 0) + (offsets.value[group]?.start(index) ?? 0)

  return { enabled, windows, scrollToItem, measure, startOf }
}
