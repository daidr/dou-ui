import { withInstall } from 'dou-ui'
import Gantt from './gantt.vue'

export const DouGantt = withInstall(Gantt)
export default DouGantt

export type {
  GanttBarLabel,
  GanttCSVErrorCode,
  GanttCSVExportOptions,
  GanttCSVImportOptions,
  GanttCSVResult,
  GanttCSVWarning,
  GanttColumn,
  GanttEmits,
  GanttExportOptions,
  GanttExpose,
  GanttImageOptions,
  GanttInsertOptions,
  GanttMarker,
  GanttMove,
  GanttPrintOptions,
  GanttProps,
  GanttSlots,
} from './types'
export { GanttCSVError } from './core/csv'
export { useGantt } from './context'
export type { GanttContext } from './context'
export { defineGanttExtension } from './core/extension'
export type {
  GanttExtension,
  GanttExtensionContext,
  GanttHistoryHandler,
  GanttKeyHandler,
} from './core/extension'
export { ganttLocales, useGanttMessages } from './locale'
export type { GanttMessages, GanttMessagesOverride } from './locale'
export { spanOf, writeSpan } from './core/model'
export type { GanttData, GanttLink, GanttLinkType, GanttTask, TaskSpan } from './core/model'
export type { GanttRow } from './core/tree'
export { resolveCalendar, workdaysBetween, workingMinutes } from './core/calendar'
export type { GanttCalendar, WorkCalendar } from './core/calendar'
export { applyGanttSteps, emptyGanttDocument, GanttTransaction } from './core/transaction'
export type { GanttDocument, GanttStep, GanttTransactionMeta } from './core/transaction'
export { checkDocument, migrateDocument } from './core/document'
export type { DocumentProblem } from './core/document'
export { baselineSpans, takeBaseline } from './core/baseline'
export type { GanttBaselineItem } from './core/baseline'
export { computeCriticalPath, computeSchedule, findBrokenLinks } from './core/schedule'
export type { GanttCriticalPath, GanttSchedule, GanttScheduleOptions } from './core/schedule'
export type { GanttMenuItem, GanttMenuTarget, GanttPoint } from './core/menu'
export { orderBetween } from './core/order'
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
