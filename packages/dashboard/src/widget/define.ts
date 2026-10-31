import { cloneJson } from '../core/transaction'
import type { Component } from 'vue'

/** A new widget's size, and the limits a resize keeps to, in columns and rows. */
export interface DashboardWidgetSize {
  w: number
  h: number
  minW?: number
  maxW?: number
  minH?: number
  maxH?: number
}

/** A kind of widget a dashboard can hold, made with `defineDashboardWidget`. */
export interface DashboardWidgetType<P extends object = Record<string, unknown>> {
  /** Stored in each widget's `type`. */
  type: string
  /** Its name in the list of widgets to add, and the title of a widget without one. */
  label: string
  /** Shown next to the label in the list of widgets to add. */
  icon?: Component
  /** The size a new widget gets, and its limits. Defaults to 4 × 3. */
  size?: DashboardWidgetSize
  /** The `props` a new widget starts with. */
  defaultProps?: P | (() => P)
  /** Draws the widget; it reads its settings and size with `useDashboardWidget()`. */
  component: Component
  /**
   * The settings form, shown in a drawer while editing. Bound with
   * `v-model` to the widget's `props`; it also gets the `widget`.
   */
  settings?: Component
  /** Whether the widget can be viewed full screen. Defaults to `true`. */
  fullscreen?: boolean
}

/**
 * Declares a kind of widget. Returns the definition as given, typed; pass
 * it in the dashboard's `widgets` list.
 *
 * ```ts
 * const stat = defineDashboardWidget({
 *   type: 'stat',
 *   label: '统计数字',
 *   size: { w: 3, h: 2, minW: 2 },
 *   defaultProps: { value: 0 },
 *   component: StatWidget,
 * })
 * ```
 */
export function defineDashboardWidget<P extends object = Record<string, unknown>>(
  type: DashboardWidgetType<P>,
): DashboardWidgetType<P> {
  return type
}

export const DEFAULT_WIDGET_SIZE: DashboardWidgetSize = { w: 4, h: 3 }

/** A copy of a type's default props for a new widget. */
export function defaultPropsOf(type: DashboardWidgetType<any> | undefined) {
  const value = type?.defaultProps
  const props = typeof value === 'function' ? value() : value
  return props ? (cloneJson(props) as Record<string, unknown>) : undefined
}
