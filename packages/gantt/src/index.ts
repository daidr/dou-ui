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
export { clampProgress, createId, spanOf, writeSpan } from './core/model'
export type { GanttData, GanttLink, GanttLinkType, GanttTask, TaskSpan } from './core/model'
export { buildTree } from './core/tree'
export type { GanttRow, GanttTree } from './core/tree'
export { offTime, resolveCalendar, workdaysBetween, workingMinutes } from './core/calendar'
export type { GanttCalendar, TimeRange, WorkCalendar } from './core/calendar'
export {
  levelByName,
  levelOf,
  nextUnit,
  scaleLevels,
  snapStep,
  unitStart,
  unitsBetween,
} from './core/scale'
export type { GanttScale, ScaleLevel, TimeUnit } from './core/scale'
export { dayStart, formatDate, formatTime, fromParts, parseTime, partsOf } from './core/time'
export type { ParsedTime, TimeParts } from './core/time'
export { arrowPath, roundedPath, routeLink } from './core/geometry'
export type { BarBox, LinkRoute, Point } from './core/geometry'

declare module 'vue' {
  export interface GlobalComponents {
    DouGantt: typeof DouGantt
  }
}
