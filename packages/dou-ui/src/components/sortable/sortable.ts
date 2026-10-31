import type { SortableDirection, SortableMoveEvent } from './use-sortable'

export type { SortableDirection, SortableMoveEvent }

export interface SortableProps<T = unknown> {
  /** The items, in order. Bound with `v-model`; replaced when an item is dropped. */
  modelValue: T[]
  /** The field that identifies each item, or a function that returns it. Defaults to `id`, or the item itself for strings and numbers. */
  itemKey?: string | ((item: T) => PropertyKey)
  /** How the items are laid out; picks the arrow keys that move them. */
  direction?: SortableDirection
  /** Lists with the same group pass items between each other. */
  group?: string
  /** Only drag from a `DouSortableHandle` inside each item. */
  handle?: boolean
  disabled?: boolean
  /** Slide the other items into place while dragging. */
  animation?: boolean
  /** The list element. */
  tag?: string
  /** The element around each item. */
  itemTag?: string
  /** Names an item in what screen readers hear while it moves. Defaults to its position. */
  itemLabel?: (item: T, index: number) => string
  /**
   * Builds the copy that follows the pointer from the item's element, e.g.
   * to keep a look that comes from outside the list once the copy sits on
   * `body`. Defaults to a deep clone.
   */
  ghost?: (el: HTMLElement) => HTMLElement
}

export interface SortableEmits<T = unknown> {
  'update:modelValue': [value: T[]]
  /** An item moved within this list. */
  sort: [event: SortableMoveEvent<T>]
  /** An item came in from another list of the group. */
  add: [event: SortableMoveEvent<T>]
  /** An item left for another list of the group. */
  remove: [event: SortableMoveEvent<T>]
}

export interface SortableSlots<T = unknown> {
  /** One item. */
  default?: (props: { item: T; index: number; dragging: boolean }) => unknown
  /** Shown in place of the items when the list is empty, e.g. as a drop area. */
  empty?: () => unknown
}

export interface SortableHandleProps {
  /** Names the handle for screen readers. */
  label?: string
}
