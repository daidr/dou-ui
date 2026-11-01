import type { SheetWorkbook } from '@dou-ui/sheet/core'
import type { Component, InjectionKey } from 'vue'
import type { DashboardPeer } from '../core/collaboration'
import type { DashboardWidget } from '../core/types'
import type { DashboardLinkedFilter } from '../data/types'
import type { DashboardMessages } from '../locale'
import type { DashboardWidgetType } from '../widget/define'

export type WidgetAction = 'settings' | 'fullscreen' | 'duplicate' | 'remove'

/** An exporter as the export menu lists it. */
export interface FrameExporter {
  name: string
  label: string
  icon?: Component
}

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
  /** The others at a widget, when editing together. */
  peers: (id: string) => readonly DashboardPeer[]
  /** How a widget gives its content as a workbook; returns what undoes it. */
  setWorkbook: (id: string, get: () => SheetWorkbook | undefined) => () => void
  /** The exporters a widget's menu lists: none unless it gives a workbook. */
  exporters: (id: string) => FrameExporter[]
  /** Writes a widget's content with an exporter, by name, and downloads the file. */
  exportTo: (id: string, exporter: string) => void
  /** Tells whether a widget is drawn in full, not only its title. */
  setDrawn: (id: string, drawn: boolean) => void
  /** Whether a widget's content is being exported now. */
  exporting: (id: string) => boolean
  /** Why the last export from a widget's menu failed. */
  exportError: (id: string) => string | undefined
  clearExportError: (id: string) => void
}

export const frameContextKey: InjectionKey<FrameContext> = Symbol('dou-dashboard-frame')
