import { inject, type ComputedRef, type InjectionKey, type Ref } from 'vue'
import type { GanttTask } from '../core/model'
import type { GanttScale } from '../core/scale'
import type { GanttTime } from '../core/time'
import type { GanttDocument } from '../core/transaction'
import type { GanttMessages } from '../locale'
import type { GanttViewport } from '../types'
import type { SchedulerResource } from './layout'
import type { SchedulerBarBox, SchedulerExpose, SchedulerRowBox } from './types'

/** The surrounding `DouScheduler`, as `useScheduler()` sees it inside slots and overlays. */
export interface SchedulerContext {
  doc: ComputedRef<GanttDocument>
  tasks: ComputedRef<GanttTask[]>
  resources: ComputedRef<SchedulerResource[]>
  selection: Ref<string[]>
  selectedResource: ComputedRef<string | null | undefined>
  collapsedGroups: ComputedRef<readonly string[]>
  readonly: ComputedRef<boolean>
  messages: ComputedRef<GanttMessages>
  scale: ComputedRef<GanttScale>
  follow: Ref<boolean>
  dayWidth: Ref<number>
  ppm: ComputedRef<number>
  tableWidth: ComputedRef<number>
  rowHeight: ComputedRef<number>
  totalWidth: ComputedRef<number>
  totalHeight: ComputedRef<number>
  viewport: ComputedRef<GanttViewport>
  panning: Ref<boolean>
  resizing: Ref<boolean>
  rows: ComputedRef<readonly SchedulerRowBox[]>
  transact: SchedulerExpose['transact']
  undo: () => boolean
  redo: () => boolean
  canUndo: Ref<boolean>
  canRedo: Ref<boolean>
  fit: SchedulerExpose['fit']
  zoomIn: () => void
  zoomOut: () => void
  scrollToDate: SchedulerExpose['scrollToDate']
  scrollToToday: () => void
  scrollToTask: SchedulerExpose['scrollToTask']
  focusTask: SchedulerExpose['focusTask']
  xOf: (time: GanttTime) => number | null
  timeAt: (x: number) => number
  rowBox: (resourceId: string) => SchedulerRowBox | null
  barBox: (taskId: string) => SchedulerBarBox | null
  announce: (text: string) => void
}

export const schedulerKey: InjectionKey<SchedulerContext> = Symbol('dou-scheduler')

/** The surrounding `DouScheduler`; for overlays, rails and custom slot components. */
export function useScheduler() {
  const context = inject(schedulerKey, null)
  if (!context)
    throw new Error('[@dou-ui/gantt] useScheduler() must be called inside <DouScheduler>')
  return context
}
