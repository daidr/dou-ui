import { withInstall } from '../../utils/install'
import Select from './select.vue'

export const DouSelect = withInstall(Select)
export default DouSelect

export type * from './select'
export type SelectInstance = InstanceType<typeof Select>

declare module 'vue' {
  export interface GlobalComponents {
    DouSelect: typeof DouSelect
  }
}
