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
  /** Shows a check mark, e.g. on the option in use; read as a checked item. */
  checked?: boolean
  run: () => void
}

export interface FlowToolbarItem {
  /** Unique within the toolbar. */
  key: string
  /** Shown as a tooltip and read by screen readers. */
  label: string
  icon: Component
  /** Pressed state, for toggles. */
  active?: boolean
  disabled?: boolean
  /** `event` is the click, e.g. to open a menu under the button. */
  run: (event: MouseEvent) => void
}
