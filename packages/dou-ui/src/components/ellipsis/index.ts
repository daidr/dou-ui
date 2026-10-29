import { withInstall } from '../../utils/install'
import Ellipsis from './ellipsis.vue'

export const DouEllipsis = withInstall(Ellipsis)
export default DouEllipsis

export type * from './ellipsis'
export type EllipsisInstance = InstanceType<typeof Ellipsis>

declare module 'vue' {
  export interface GlobalComponents {
    DouEllipsis: typeof DouEllipsis
  }
}
