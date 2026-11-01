import type { VirtualListProps } from './virtual-list'
import { withInstall } from '../../utils/install'
import VirtualList from './virtual-list.vue'

export const DouVirtualList = withInstall(VirtualList)
export default DouVirtualList

export type * from './virtual-list'
export { createOffsets } from './virtual-list'

declare module 'vue' {
  export interface GlobalComponents {
    DouVirtualList: typeof DouVirtualList
  }
}

declare module '../config-provider/config-provider' {
  export interface GenericComponentProps {
    DouVirtualList: VirtualListProps
  }
}
