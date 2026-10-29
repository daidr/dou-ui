import { withInstall } from '../../utils/install'
import Shimmer from './shimmer.vue'

export const DouShimmer = withInstall(Shimmer)
export default DouShimmer

export type * from './shimmer'
export type ShimmerInstance = InstanceType<typeof Shimmer>

declare module 'vue' {
  export interface GlobalComponents {
    DouShimmer: typeof DouShimmer
  }
}
