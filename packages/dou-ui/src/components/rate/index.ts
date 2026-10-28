import { withInstall } from '../../utils/install'
import Rate from './rate.vue'

export const DouRate = withInstall(Rate)
export default DouRate

export type * from './rate'
export type RateInstance = InstanceType<typeof Rate>

declare module 'vue' {
  export interface GlobalComponents {
    DouRate: typeof DouRate
  }
}
