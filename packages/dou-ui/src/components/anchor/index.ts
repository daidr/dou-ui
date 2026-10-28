import { withInstall } from '../../utils/install'
import Anchor from './anchor.vue'

export const DouAnchor = withInstall(Anchor)
export default DouAnchor

export type * from './anchor'
export type AnchorInstance = InstanceType<typeof Anchor>

declare module 'vue' {
  export interface GlobalComponents {
    DouAnchor: typeof DouAnchor
  }
}
