import type { Component } from 'vue'
import type { DropdownItemTone, DropdownValue } from '../dropdown/dropdown'

/**
 * A menu item written as data, for menus that are built in code: the
 * `items` of `DouContextMenu` and `DouDropdown`, and the menus of the
 * calendar, flow and Gantt components.
 */
export interface ContextMenuItem {
  /** Unique within the menu; also what `select` reports. */
  key: string
  label: string
  icon?: Component
  /** A key to show after the label, written as in `useHotkey`; only shown. */
  shortcut?: string
  disabled?: boolean
  tone?: DropdownItemTone
  /** Draw a separator above the item. */
  divided?: boolean
  /**
   * Shows a check mark on the option in use. When every item of a menu has
   * it, the menu is one choice and its items are read as radio items.
   */
  checked?: boolean
  /** Called when the item is chosen; leave it out to handle `select` instead. */
  run?: () => void
}

export interface ContextMenuProps {
  /** Whether the menu is open, bound with `v-model:open`. */
  open?: boolean
  /** Leave the browser's own menu in place. */
  disabled?: boolean
  /** Close the menu once an item is chosen. */
  hideOnSelect?: boolean
  /** Where to render the menu; `false` keeps it in place. */
  teleport?: string | HTMLElement | false
  /**
   * The items as data, in place of the `menu` slot; a chosen item's `run`
   * is called. Ignored when the `menu` slot is given.
   */
  items?: ContextMenuItem[]
}

export interface ContextMenuEmits {
  'update:open': [open: boolean]
  /** An item was chosen. */
  select: [value: DropdownValue | undefined]
}

export interface ContextMenuSlots {
  /** The area that opens the menu. Its first element receives the listener. */
  default?: () => unknown
  /** The items, `DouDropdownItem`s. */
  menu?: () => unknown
}

export interface ContextMenuExpose {
  /**
   * Open the menu at a point in the viewport. With `box`, the point is the
   * top left of a box of that width and height, e.g. the button that opened
   * it: the menu opens below the box, or above it when there is no room, and
   * never covers it.
   */
  open: (x: number, y: number, box?: { width: number; height: number }) => void
  close: () => void
}
