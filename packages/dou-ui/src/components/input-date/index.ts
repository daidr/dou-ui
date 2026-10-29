import { withInstall } from '../../utils/install'
import InputDate from './input-date.vue'

export const DouInputDate = withInstall(InputDate)
export default DouInputDate

export type * from './input-date'
export type InputDateInstance = InstanceType<typeof InputDate>

declare module 'vue' {
  export interface GlobalComponents {
    DouInputDate: typeof DouInputDate
  }
}
