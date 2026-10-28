import { withInstall } from '../../utils/install'
import Collapse from './collapse.vue'
import CollapseItem from './collapse-item.vue'

export const DouCollapse = withInstall(Collapse)
export const DouCollapseItem = withInstall(CollapseItem)
export default DouCollapse

export type * from './collapse'
export type CollapseInstance = InstanceType<typeof Collapse>
export type CollapseItemInstance = InstanceType<typeof CollapseItem>

declare module 'vue' {
  export interface GlobalComponents {
    DouCollapse: typeof DouCollapse
    DouCollapseItem: typeof DouCollapseItem
  }
}
