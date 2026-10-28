import { withInstall } from '../../utils/install'
import Skeleton from './skeleton.vue'

export const DouSkeleton = withInstall(Skeleton)
export default DouSkeleton

export type * from './skeleton'
export type SkeletonInstance = InstanceType<typeof Skeleton>

declare module 'vue' {
  export interface GlobalComponents {
    DouSkeleton: typeof DouSkeleton
  }
}
