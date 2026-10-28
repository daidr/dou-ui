import { withInstall } from '../../utils/install'
import Timeline from './timeline.vue'
import TimelineItem from './timeline-item.vue'

export const DouTimeline = withInstall(Timeline)
export const DouTimelineItem = withInstall(TimelineItem)
export default DouTimeline

export type * from './timeline'
export type TimelineInstance = InstanceType<typeof Timeline>
export type TimelineItemInstance = InstanceType<typeof TimelineItem>

declare module 'vue' {
  export interface GlobalComponents {
    DouTimeline: typeof DouTimeline
    DouTimelineItem: typeof DouTimelineItem
  }
}
