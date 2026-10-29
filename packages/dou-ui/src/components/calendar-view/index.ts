import { withInstall } from '../../utils/install'
import CalendarView from './calendar-view.vue'

export const DouCalendarView = withInstall(CalendarView)
export default DouCalendarView

export type * from './calendar-view'
export type CalendarViewInstance = InstanceType<typeof CalendarView>

declare module 'vue' {
  export interface GlobalComponents {
    DouCalendarView: typeof DouCalendarView
  }
}
