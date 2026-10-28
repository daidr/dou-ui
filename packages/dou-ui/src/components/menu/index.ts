import { withInstall } from '../../utils/install'
import Menu from './menu.vue'

export const DouMenu = withInstall(Menu)
export default DouMenu

export type * from './menu'
export type MenuInstance = InstanceType<typeof Menu>

declare module 'vue' {
  export interface GlobalComponents {
    DouMenu: typeof DouMenu
  }
}
