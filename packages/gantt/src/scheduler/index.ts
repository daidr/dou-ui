import { withInstall } from 'dou-ui'
import Scheduler from './scheduler.vue'

export const DouScheduler = withInstall(Scheduler)
export default DouScheduler

export { groupByResource, loadSegments, packLanes } from './layout'
export type { GanttResource, LoadSegment, SchedulerItem } from './layout'
export type {
  SchedulerEmits,
  SchedulerExpose,
  SchedulerProps,
  SchedulerRange,
  SchedulerSlots,
} from './types'

declare module 'vue' {
  export interface GlobalComponents {
    DouScheduler: typeof DouScheduler
  }
}
