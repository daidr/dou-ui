import { withInstall } from '../../utils/install'
import Divider from './divider.vue'

export const DouDivider = withInstall(Divider)
export default DouDivider

export type * from './divider'
export type DividerInstance = InstanceType<typeof Divider>

declare module 'vue' {
  export interface GlobalComponents {
    DouDivider: typeof DouDivider
  }
}
