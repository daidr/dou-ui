import type { Component } from 'vue'
import type { FlowEdge, FlowNode, Point } from './model'

/** What a context menu was opened on. `point` is in canvas coordinates. */
export type FlowMenuTarget =
  | { kind: 'node'; node: FlowNode; point: Point }
  | { kind: 'edge'; edge: FlowEdge; point: Point }
  | { kind: 'canvas'; point: Point }

export interface FlowMenuItem {
  /** Unique within the menu. */
  key: string
  label: string
  icon?: Component
  /** A key to show after the label, written as in `useHotkey`; only shown. */
  shortcut?: string
  disabled?: boolean
  tone?: 'danger'
  /** Draw a separator above the item. */
  divided?: boolean
  /**
   * Shows a check mark on the option in use. When every item of a menu has
   * it, the menu is one choice and its items are read as radio items.
   */
  checked?: boolean
  run: () => void
}

export interface FlowToolbarItem {
  /** Unique within the toolbar. */
  key: string
  /** Shown as a tooltip and read by screen readers. */
  label: string
  icon: Component
  /** Called on click; gets the click, e.g. to place something by the button. */
  run?: (event: MouseEvent) => void
  disabled?: boolean
  /** For a button that turns something on and off: whether it is on. */
  pressed?: boolean
  /**
   * The key that does the same, as a hotkey like `mod+d`: shown in the
   * tooltip and given to screen readers as `aria-keyshortcuts`. It is only
   * a hint; bind the key with `keymap`.
   */
  shortcut?: string
  /**
   * Choices to show under the button instead of `run`: the editor places
   * the menu, marks the button as opening one, and closes it on a second
   * click. Give the items `checked` to mark the one in use.
   */
  children?: FlowMenuItem[]
}
