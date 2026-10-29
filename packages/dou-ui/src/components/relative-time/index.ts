import { withInstall } from '../../utils/install'
import RelativeTime from './relative-time.vue'

export const DouRelativeTime = withInstall(RelativeTime)
export default DouRelativeTime

export type * from './relative-time'
export type RelativeTimeInstance = InstanceType<typeof RelativeTime>

declare module 'vue' {
  export interface GlobalComponents {
    DouRelativeTime: typeof DouRelativeTime
  }
}
