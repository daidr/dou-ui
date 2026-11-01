import type { GridCompact, GridItem } from '../layout/types'
import type { DashboardMessagesOverride } from '../locale'

/** An edge or corner of an item that can be dragged to resize it. */
export type GridResizeHandle = 'e' | 's' | 'se'

/** An item's place on one breakpoint's grid. */
export type GridPlace = Pick<GridItem, 'id' | 'x' | 'y' | 'w' | 'h'>

/** The places items were given on the narrower breakpoints, by breakpoint name. */
export type GridLayouts = Partial<Record<string, GridPlace[]>>

/** A new item dragged in from outside the grid; it gets its place where it is dropped. */
export type GridDropItem = Omit<GridItem, 'x' | 'y'>

export interface GridLayoutProps {
  /**
   * The items, laid out on the widest breakpoint; `v-model` is updated once
   * each move or resize ends.
   */
  modelValue?: GridItem[]
  /**
   * Where items were moved on the narrower breakpoints (`v-model:layouts`).
   * A breakpoint without one, or an item missing from one, is laid out from
   * `modelValue`.
   */
  layouts?: GridLayouts
  /**
   * How many columns the grid has: one number, or one per breakpoint.
   * Defaults to `{ lg: 12, md: 6, sm: 1 }`.
   */
  columns?: number | Record<string, number>
  /**
   * The narrowest width of the grid itself (not the window) at which each
   * breakpoint applies, in px. Defaults to `{ lg: 1024, md: 640, sm: 0 }`.
   */
  breakpoints?: Record<string, number>
  /** The height of a row, in px. Defaults to 80. */
  rowHeight?: number
  /** The space between items, in px: one number, or `[across, down]`. Defaults to 16. */
  gap?: number | [number, number]
  /** `'vertical'` (the default) floats items up into gaps; `false` leaves them where they are put. */
  compact?: GridCompact
  /** Whether items can be moved and resized, with the pointer and the keyboard. */
  editable?: boolean
  /**
   * Moves start only from a `DouGridLayoutHandle` inside the item, such as
   * its title bar. Defaults to `false`: the whole item.
   */
  handle?: boolean
  /** Which edges resize an item; `false` turns resizing off. Defaults to `['e', 's', 'se']`. */
  resize?: boolean | GridResizeHandle[]
  /** The name an item is read out by. Defaults to its id. */
  itemLabel?: (item: GridItem) => string
  /** The layout's accessible name. */
  label?: string
  /** Overrides of the built-in texts. */
  messages?: DashboardMessagesOverride
}

/** Why the layout changed. */
export type GridChangeReason = 'move' | 'resize' | 'keyboard' | 'drop'

export interface GridChangeEvent {
  /** The layout after the change (the same as the new `v-model`). */
  items: GridItem[]
  /** The item that was moved, resized or dropped. */
  id: string
  reason: GridChangeReason
  /** The breakpoint whose layout changed. */
  breakpoint: string
}

export interface GridDropEvent {
  /** The new item, in its place on the widest breakpoint (as added to `v-model`). */
  item: GridItem
  /** What was passed to `startDrop`. */
  data: unknown
  /** The breakpoint it was dropped on. */
  breakpoint: string
}

export interface GridDragEvent {
  id: string
  kind: 'move' | 'resize' | 'drop'
}

export interface GridDragEndEvent extends GridDragEvent {
  /** Whether the drag was undone with Escape (or the pointer was lost). */
  cancelled: boolean
}

export interface GridLayoutEmits {
  'update:modelValue': [items: GridItem[]]
  change: [event: GridChangeEvent]
  dragStart: [event: GridDragEvent]
  dragEnd: [event: GridDragEndEvent]
  drop: [event: GridDropEvent]
  'update:layouts': [layouts: GridLayouts]
  breakpointChange: [breakpoint: string]
}

export interface GridLayoutExpose {
  /** Moves keyboard focus to an item (when the layout is editable, the item itself; else its first focusable part). */
  focusItem: (id: string) => void
  /** Scrolls an item into view. */
  scrollToItem: (id: string, options?: ScrollIntoViewOptions) => void
  /**
   * Starts dragging a new item in from outside, such as from a list of
   * widgets: call it in that element's `pointerdown`. A mouse starts after
   * moving a little, a finger after resting on it. Dropped over the grid,
   * the item is added to `v-model` and `drop` is emitted; Escape or a drop
   * elsewhere cancels.
   */
  startDrop: (event: PointerEvent, item: GridDropItem, data?: unknown) => void
  /** The breakpoint in use, from the grid's own width. */
  readonly breakpoint: string
}

export interface GridItemSlotProps {
  item: GridItem
  /** Being moved with the pointer or the keyboard. */
  dragging: boolean
  /** Being resized with the pointer. */
  resizing: boolean
}
