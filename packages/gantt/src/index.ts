import { withInstall } from 'dou-ui'
import Gantt from './gantt.vue'

export const DouGantt = withInstall(Gantt)
export default DouGantt

export type {
  GanttBarLabel,
  GanttColumn,
  GanttEmits,
  GanttExpose,
  GanttProps,
  GanttSlots,
} from './types'
export { ganttLocales, useGanttMessages } from './locale'
export type { GanttMessages, GanttMessagesOverride } from './locale'
export { spanOf, writeSpan } from './core/model'
export type { GanttData, GanttLink, GanttLinkType, GanttTask, TaskSpan } from './core/model'
export type { GanttRow } from './core/tree'
export { resolveCalendar, workdaysBetween, workingMinutes } from './core/calendar'
export type { GanttCalendar, WorkCalendar } from './core/calendar'
export { applySteps, GanttTransaction } from './core/transaction'
export type { GanttDocument, GanttStep, GanttTransactionMeta } from './core/transaction'
export { parseLag } from './core/links'
export type { GanttLag, GanttLinkRefusal } from './core/links'
export type { GanttScale } from './core/scale'
export { formatTime, parseTime } from './core/time'
export type { ParsedTime } from './core/time'

declare module 'vue' {
  export interface GlobalComponents {
    DouGantt: typeof DouGantt
  }
}
