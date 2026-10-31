import type { GridCompact, GridItem } from '../layout/types'
import type { DashboardMessagesOverride } from '../locale'

/** An edge or corner of an item that can be dragged to resize it. */
export type GridResizeHandle = 'e' | 's' | 'se'

export interface GridLayoutProps {
  /** The items; `v-model` is updated once each move or resize ends. */
  modelValue?: GridItem[]
  /** How many columns the grid has. Defaults to 12. */
  columns?: number
  /** The height of a row, in px. Defaults to 80. */
  rowHeight?: number
  /** The space between items, in px: one number, or `[across, down]`. Defaults to 16. */
  gap?: number | [number, number]
  /** `'vertical'` (the default) floats items up into gaps; `false` leaves them where they are put. */
  compact?: GridCompact
  /** Whether items can be moved and resized, with the pointer and the keyboard. */
  editable?: boolean
  /**
   * A CSS selector for the part of an item that starts a move, such as its
   * title bar. Defaults to the whole item.
   */
  handle?: string
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
export type GridChangeReason = 'move' | 'resize' | 'keyboard'

export interface GridChangeEvent {
  /** The layout after the change (the same as the new `v-model`). */
  items: GridItem[]
  /** The item that was moved or resized. */
  id: string
  reason: GridChangeReason
}

export interface GridDragEvent {
  id: string
  kind: 'move' | 'resize'
}

export interface GridDragEndEvent extends GridDragEvent {
  /** Whether the drag was undone with Escape (or the pointer was lost). */
  cancelled: boolean
}

export interface GridLayoutEmits {
  'update:modelValue': [items: GridItem[]]
  change: [event: GridChangeEvent]
  'drag-start': [event: GridDragEvent]
  'drag-end': [event: GridDragEndEvent]
}

export interface GridLayoutExpose {
  /** Moves keyboard focus to an item (when the layout is editable, the item itself; else its first focusable part). */
  focusItem: (id: string) => void
  /** Scrolls an item into view. */
  scrollToItem: (id: string, options?: ScrollIntoViewOptions) => void
}

export interface GridItemSlotProps {
  item: GridItem
  /** Being moved with the pointer or the keyboard. */
  dragging: boolean
  /** Being resized with the pointer. */
  resizing: boolean
}
