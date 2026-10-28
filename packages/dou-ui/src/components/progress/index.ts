import { withInstall } from '../../utils/install'
import Progress from './progress.vue'

export const DouProgress = withInstall(Progress)
export default DouProgress

export type * from './progress'
export type ProgressInstance = InstanceType<typeof Progress>

declare module 'vue' {
  export interface GlobalComponents {
    DouProgress: typeof DouProgress
  }
}
