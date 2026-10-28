import { withInstall } from '../../utils/install'
import Calendar from './calendar.vue'
import DatePicker from './date-picker.vue'

export const DouDatePicker = withInstall(DatePicker)
export const DouCalendar = withInstall(Calendar)
export default DouDatePicker

export type * from './date-picker'
export type { DateUnit } from './date'
export type DatePickerInstance = InstanceType<typeof DatePicker>
export type CalendarInstance = InstanceType<typeof Calendar>

declare module 'vue' {
  export interface GlobalComponents {
    DouDatePicker: typeof DouDatePicker
    DouCalendar: typeof DouCalendar
  }
}
