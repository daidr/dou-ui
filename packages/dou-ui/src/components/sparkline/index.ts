import { withInstall } from '../../utils/install'
import Sparkline from './sparkline.vue'

export const DouSparkline = withInstall(Sparkline)
export default DouSparkline

export type * from './sparkline'
export type SparklineInstance = InstanceType<typeof Sparkline>

declare module 'vue' {
  export interface GlobalComponents {
    DouSparkline: typeof DouSparkline
  }
}
