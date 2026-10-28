import { withInstall } from '../../utils/install'
import Alert from './alert.vue'

export const DouAlert = withInstall(Alert)
export default DouAlert

export type * from './alert'
export type AlertInstance = InstanceType<typeof Alert>

declare module 'vue' {
  export interface GlobalComponents {
    DouAlert: typeof DouAlert
  }
}
