import { withInstall } from '../../utils/install'
import TimePicker from './time-picker.vue'

export const DouTimePicker = withInstall(TimePicker)
export default DouTimePicker

export type * from './time-picker'
export type TimePickerInstance = InstanceType<typeof TimePicker>

declare module 'vue' {
  export interface GlobalComponents {
    DouTimePicker: typeof DouTimePicker
  }
}
