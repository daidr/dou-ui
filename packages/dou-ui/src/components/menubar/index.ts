import { withInstall } from '../../utils/install'
import type { ButtonAttributes } from '../../utils/install'
import Menubar from './menubar.vue'
import MenubarMenu from './menubar-menu.vue'

export const DouMenubar = withInstall(Menubar)
export const DouMenubarMenu = withInstall<typeof MenubarMenu, ButtonAttributes>(MenubarMenu)
export default DouMenubar

export type * from './menubar'
export type MenubarInstance = InstanceType<typeof Menubar>
export type MenubarMenuInstance = InstanceType<typeof MenubarMenu>

declare module 'vue' {
  export interface GlobalComponents {
    DouMenubar: typeof DouMenubar
    DouMenubarMenu: typeof DouMenubarMenu
  }
}
