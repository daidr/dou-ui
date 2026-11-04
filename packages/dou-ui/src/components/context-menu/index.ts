import { withInstall } from '../../utils/install'
import { forwardsTrigger } from '../../utils/only-child'
import ContextMenu from './context-menu.vue'

export const DouContextMenu = forwardsTrigger(withInstall(ContextMenu))
export default DouContextMenu

export type * from './context-menu'
export type ContextMenuInstance = InstanceType<typeof ContextMenu>

declare module 'vue' {
  export interface GlobalComponents {
    DouContextMenu: typeof DouContextMenu
  }
}
