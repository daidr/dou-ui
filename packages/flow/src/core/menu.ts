import type { ContextMenuItem } from 'dou-ui'
import type { Component } from 'vue'
import type { FlowEdge, FlowNode, Point } from './model'

/** What a context menu was opened on. `point` is in canvas coordinates. */
export type FlowMenuTarget =
  | { kind: 'node'; node: FlowNode; point: Point }
  | { kind: 'edge'; edge: FlowEdge; point: Point }
  | { kind: 'canvas'; point: Point }

/** One preset swatch inside a toolbar color popover. */
export interface FlowToolbarColorPreset {
  /** Stored value passed to `select`, e.g. `'blue'`. */
  value: string
  /** Accessible name and tooltip, e.g. `'蓝色'`. */
  label: string
  /** CSS color painted on the swatch. */
  swatch: string
}

/** A color picker popover opened by a toolbar button. */
export interface FlowToolbarColor {
  /**
   * Current value across the selection:
   * - `undefined`: every selected item uses the default
   * - `null`: selected items differ (mixed)
   * - string: shared preset, none value (e.g. `'none'`), or custom CSS color
   */
  value: string | null | undefined
  /** How swatches and the button indicator look. Defaults to `'stroke'`. */
  kind?: 'fill' | 'stroke' | 'text'
  /** CSS color shown on the button indicator; omitted for default, none or mixed. */
  swatch?: string
  /** Whether the selection is explicitly in the "none" state (e.g. borderless or transparent). */
  none?: boolean
  /** Label for the default swatch that clears the color (`select(undefined)`). */
  defaultLabel: string
  /** Optional "none" option, such as "无边框" or "无填充". */
  noneOption?: {
    /** Stored value passed to `select`, e.g. `'none'`. */
    value: string
    /** Visible text and accessible label. */
    label: string
    /** Optional icon for the none action button. */
    icon?: Component
  }
  /** One-click preset swatches shown before custom color picking. */
  presets: FlowToolbarColorPreset[]
  /** Label for toggling the custom `DouColorPanel`. */
  customLabel: string
  /**
   * Applies a chosen color, `'none'`, or `undefined` (default).
   * `options.live` is `true` while dragging in the custom color panel so
   * consecutive updates can share an undo group.
   */
  select: (value: string | undefined, options?: { live?: boolean }) => void
}

export interface FlowToolbarItem {
  /** Unique within the toolbar. */
  key: string
  /** Shown as a tooltip and read by screen readers. */
  label: string
  icon: Component
  /** Called on click. */
  run?: () => void
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
  children?: ContextMenuItem[]
  /**
   * Color swatches and custom color panel shown in a popover under the button
   * instead of `run` or `children`.
   */
  color?: FlowToolbarColor
  /**
   * Shown while the editor is `readonly` too, for what doesn't change the
   * flow, such as commenting; the other buttons are left out then.
   */
  showWhenReadonly?: boolean
}
