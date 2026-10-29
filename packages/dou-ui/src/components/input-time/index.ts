import { withInstall } from '../../utils/install'
import InputTime from './input-time.vue'

export const DouInputTime = withInstall(InputTime)
export default DouInputTime

export type * from './input-time'
export type InputTimeInstance = InstanceType<typeof InputTime>

declare module 'vue' {
  export interface GlobalComponents {
    DouInputTime: typeof DouInputTime
  }
}
