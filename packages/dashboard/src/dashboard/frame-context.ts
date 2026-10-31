import type { InjectionKey } from 'vue'
import type { DashboardWidget } from '../core/types'
import type { DashboardLinkedFilter } from '../data/types'
import type { DashboardMessages } from '../locale'
import type { DashboardWidgetType } from '../widget/define'

export type WidgetAction = 'settings' | 'fullscreen' | 'duplicate' | 'remove'

/**
 * What a widget's frame reads from its dashboard. The frame looks its widget
 * up by id in a computed of its own, so a change to one widget draws only
 * that widget's frame again, not every frame on the grid.
 */
export interface FrameContext {
  widget: (id: string) => DashboardWidget | undefined
  type: (widget: DashboardWidget) => DashboardWidgetType<any> | undefined
  title: (widget: DashboardWidget) => string
  editing: () => boolean
  messages: () => DashboardMessages
  /** Whether a frame mounting now is drawn in full at once. */
  eager: (id: string) => boolean
  /** Whether every widget is drawn in full now, to export or print the dashboard. */
  all: () => boolean
  setProps: (id: string, patch: Record<string, unknown>, options?: { group?: string }) => void
  action: (id: string, action: WidgetAction) => void
  rename: (id: string, title: string) => void
  /** The filters a widget set, shown in its title bar. */
  linked: (id: string) => DashboardLinkedFilter[]
  clearFilter: (key: string) => void
}

export const frameContextKey: InjectionKey<FrameContext> = Symbol('dou-dashboard-frame')
