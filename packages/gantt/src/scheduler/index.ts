import { withInstall } from 'dou-ui'
import Scheduler from './scheduler.vue'

export const DouScheduler = withInstall(Scheduler)
export default DouScheduler

export { findConflict, groupByResource, loadSegments, packLanes } from './layout'
export type {
  SchedulerItem,
  SchedulerLoadSegment,
  SchedulerPlace,
  SchedulerResource,
} from './layout'
export type {
  SchedulerEmits,
  SchedulerExpose,
  SchedulerMenuTarget,
  SchedulerMove,
  SchedulerProps,
  SchedulerRange,
  SchedulerSlots,
} from './types'

declare module 'vue' {
  export interface GlobalComponents {
    DouScheduler: typeof DouScheduler
  }
}
