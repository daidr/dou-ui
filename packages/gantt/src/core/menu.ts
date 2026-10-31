import type { Component } from 'vue'
import type { GanttLink, GanttTask } from './model'

/** What a context menu was opened on: a task (bar or row), a link, or an empty part of the timeline. */
export type GanttMenuTarget =
  { kind: 'task'; task: GanttTask } | { kind: 'link'; link: GanttLink } | { kind: 'empty' }

export interface GanttMenuItem {
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
  run: () => void
}
