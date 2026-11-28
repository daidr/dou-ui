import { withInstall } from 'dou-ui'
import Scheduler from './scheduler.vue'

export const DouScheduler = withInstall(Scheduler)
export default DouScheduler

export { useScheduler } from './context'
export type { SchedulerContext } from './context'
export { findConflict, groupByResource, loadSegments, packLanes } from './layout'
export type {
  SchedulerItem,
  SchedulerLoadSegment,
  SchedulerPlace,
  SchedulerResource,
} from './layout'
export type {
  SchedulerBarBox,
  SchedulerCanvasScope,
  SchedulerEmits,
  SchedulerExpose,
  SchedulerMenuTarget,
  SchedulerMove,
  SchedulerProps,
  SchedulerRailScope,
  SchedulerRange,
  SchedulerRowBox,
  SchedulerRowInfo,
  SchedulerSlots,
} from './types'
export type { GanttViewport } from '../types'

declare module 'vue' {
  export interface GlobalComponents {
    DouScheduler: typeof DouScheduler
  }
}
