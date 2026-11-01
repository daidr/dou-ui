import type { DropdownValue } from '../dropdown/dropdown'

export interface ContextMenuProps {
  /** Whether the menu is open, bound with `v-model:open`. */
  open?: boolean
  /** Leave the browser's own menu in place. */
  disabled?: boolean
  /** Close the menu once an item is chosen. */
  hideOnSelect?: boolean
  /** Where to render the menu; `false` keeps it in place. */
  teleport?: string | HTMLElement | false
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
