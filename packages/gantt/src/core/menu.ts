import type { Component } from 'vue'
import type { GanttLink, GanttTask } from './model'

/** A point on the timeline, in px from its start and from the top of the rows. */
export interface GanttPoint {
  x: number
  y: number
}

/**
 * What a context menu was opened on: a task (bar or row), a link, or an
 * empty part of the timeline. `point` is where, in timeline coordinates,
 * and `time` the moment under it, in minutes; from the table or the
 * keyboard they are at the task's start.
 */
export type GanttMenuTarget =
  | { kind: 'task'; task: GanttTask; point: GanttPoint; time: number }
  | { kind: 'link'; link: GanttLink; point: GanttPoint; time: number }
  | { kind: 'canvas'; point: GanttPoint; time: number }

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
