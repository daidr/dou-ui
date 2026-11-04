import { withInstall } from '../../utils/install'
import StatusDot from './status-dot.vue'

export const DouStatusDot = withInstall(StatusDot)
export default DouStatusDot

export type * from './status-dot'
export type StatusDotInstance = InstanceType<typeof StatusDot>

declare module 'vue' {
  export interface GlobalComponents {
    DouStatusDot: typeof DouStatusDot
  }
}
