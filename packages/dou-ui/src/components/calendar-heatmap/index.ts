import { withInstall } from '../../utils/install'
import CalendarHeatmap from './calendar-heatmap.vue'

export const DouCalendarHeatmap = withInstall(CalendarHeatmap)
export default DouCalendarHeatmap

export type * from './calendar-heatmap'
export type CalendarHeatmapInstance = InstanceType<typeof CalendarHeatmap>

declare module 'vue' {
  export interface GlobalComponents {
    DouCalendarHeatmap: typeof DouCalendarHeatmap
  }
}
