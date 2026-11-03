import { inject, type ComputedRef, type InjectionKey, type Ref } from 'vue'
import type { GanttLink, GanttTask } from './core/model'
import type { GanttCriticalPath } from './core/schedule'
import type { GanttScale } from './core/scale'
import type { GanttDocument } from './core/transaction'
import type { GanttRow } from './core/tree'
import type { GanttExpose } from './types'
import type { GanttMessages } from './locale'

/** The surrounding Gantt chart, as `useGantt()` and extensions see it. */
export interface GanttContext {
  /** The whole document as it is now; change it with `transact`. */
  doc: ComputedRef<GanttDocument>
  /** The document's tasks and links, as a shortcut. */
  tasks: ComputedRef<GanttTask[]>
  links: ComputedRef<GanttLink[]>
  selection: Ref<string[]>
  /** The task the keyboard is on. */
  active: Ref<string | null>
  readonly: ComputedRef<boolean>
  messages: ComputedRef<GanttMessages>
  scale: ComputedRef<GanttScale>
  /** How wide a day is, in px. */
  dayWidth: Ref<number>
  /** Height of a row, in px. */
  rowHeight: ComputedRef<number>
  /** The rows as laid out, with spans and summaries worked out. */
  rows: ComputedRef<GanttRow[]>
  /**
   * While a bar is dragged: the tasks it would change, with the ones it
   * would push, as they would be written. `null` otherwise.
   */
  preview: ComputedRef<Map<string, Partial<GanttTask>> | null>
  transact: GanttExpose['transact']
  /** The critical path when `critical` is on, `null` otherwise. */
  critical: ComputedRef<GanttCriticalPath | null>
  /** Links not kept by the dates as they are. */
  brokenLinks: ComputedRef<Set<string>>
  schedule: GanttExpose['schedule']
  editCell: GanttExpose['editCell']
  insertTask: GanttExpose['insertTask']
  indentTask: GanttExpose['indentTask']
  outdentTask: GanttExpose['outdentTask']
  undo: () => boolean
  redo: () => boolean
  canUndo: Ref<boolean>
  canRedo: Ref<boolean>
  fit: () => void
  zoomIn: () => void
  zoomOut: () => void
  scrollToDate: GanttExpose['scrollToDate']
  scrollToTask: GanttExpose['scrollToTask']
  scrollToToday: () => void
  /** Puts the keyboard on a task, scrolls it into view and focuses its bar. */
  focusTask: (id: string) => void
  /** Where a time (a date string or minutes) is on the timeline, in px from its start. */
  xOf: (time: string | number) => number | null
  /** Where a task's row is on the timeline, in px from the top of the rows. */
  rowTop: (id: string) => number | null
  /** Says `text` to screen readers. */
  announce: (text: string) => void
}

export const ganttKey: InjectionKey<GanttContext> = Symbol('dou-gantt')

/** The surrounding Gantt chart; for layers, overlays and the chart's slots. */
export function useGantt() {
  const context = inject(ganttKey, null)
  if (!context) throw new Error('[@dou-ui/gantt] useGantt() must be called inside <DouGantt>')
  return context
}
