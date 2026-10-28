import { withInstall } from '../../utils/install'
import Drawer from './drawer.vue'

export const DouDrawer = withInstall(Drawer)
export default DouDrawer

export type * from './drawer'
export type DrawerInstance = InstanceType<typeof Drawer>

declare module 'vue' {
  export interface GlobalComponents {
    DouDrawer: typeof DouDrawer
  }
}
