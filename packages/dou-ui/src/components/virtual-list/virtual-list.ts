export type VirtualListKey = string | number
export type VirtualListAlign = 'start' | 'center' | 'end' | 'nearest'

/** The key of an item as `itemKey` gives it: a property, a function, or the index. */
export function virtualItemKey<T>(
  itemKey: VirtualListProps<T>['itemKey'],
  item: T,
  index: number,
): VirtualListKey {
  if (typeof itemKey === 'function') return itemKey(item, index)
  if (itemKey) return (item as Record<string, VirtualListKey>)[itemKey]!
  return index
}

export interface VirtualListProps<T = any> {
  /** The items. Only those in or near the viewport are rendered. */
  items: T[]
  /**
   * The height of each item in px, or a function giving it per item.
   * Heights are known up front, so the scrollbar never jumps. Without it,
   * items are measured once rendered.
   */
  itemSize?: number | ((item: T, index: number) => number)
  /** Without `itemSize`, the height to assume for an item not rendered yet. */
  estimateSize?: number | ((item: T, index: number) => number)
  /** A property of each item, or a function, that gives it a unique key. Defaults to the index. */
  itemKey?: string | ((item: T, index: number) => VirtualListKey)
  /** The height of the viewport. A number is in px. Without it the list fills its container. */
  height?: number | string
  /** Extra items rendered above and below the viewport, so fast scrolling shows no gaps. */
  overscan?: number
  /** How close to the bottom, in px, counts as reaching the end. */
  endThreshold?: number
}

export interface VirtualListEmits {
  scroll: [event: Event]
  /** Scrolled within `endThreshold` of the bottom, e.g. to load the next page. */
  endReached: []
}

export interface VirtualListSlots<T = any> {
  /** One item. */
  default?: (props: { item: T; index: number }) => unknown
  /** Shown when there are no items. */
  empty?: () => unknown
}

export interface VirtualListExpose {
  /** Scroll so the item at `index` is visible. `nearest` scrolls as little as possible. */
  scrollToIndex: (index: number, align?: VirtualListAlign) => void
  /** Scroll to an offset in px. */
  scrollTo: (offset: number) => void
  /** The scrolling element. */
  el: () => HTMLElement | null
}

/**
 * Offsets of items with known heights. `start(i)` is where item `i`
 * begins; `find(y)` is the item covering `y`, by binary search.
 */
export function createOffsets(count: number, size: (index: number) => number) {
  const starts = new Float64Array(count + 1)
  for (let index = 0; index < count; index++) starts[index + 1] = starts[index]! + size(index)
  const start = (index: number) => starts[Math.max(0, Math.min(index, count))]!
  function find(y: number) {
    let low = 0
    let high = count - 1
    while (low < high) {
      const mid = (low + high + 1) >> 1
      if (starts[mid]! <= y) low = mid
      else high = mid - 1
    }
    return Math.max(0, low)
  }
  return { total: starts[count]!, start, find }
}
