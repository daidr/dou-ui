import { withInstall } from '../../utils/install'
import { forwardsTrigger } from '../../utils/only-child'
import ContextMenu from './context-menu.vue'

export const DouContextMenu = withInstall(ContextMenu)
// 默认插槽就是触发元素：套在另一个浮层外面时，属性转交给插槽
forwardsTrigger(ContextMenu)
export default DouContextMenu

export type * from './context-menu'
export type ContextMenuInstance = InstanceType<typeof ContextMenu>

declare module 'vue' {
  export interface GlobalComponents {
    DouContextMenu: typeof DouContextMenu
  }
}
