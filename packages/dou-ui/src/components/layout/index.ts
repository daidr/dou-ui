import { withInstall } from '../../utils/install'
import type { ButtonAttributes } from '../../utils/install'
import Layout from './layout.vue'
import LayoutAside from './layout-aside.vue'
import LayoutAsideTrigger from './layout-aside-trigger.vue'
import LayoutFooter from './layout-footer.vue'
import LayoutHeader from './layout-header.vue'
import LayoutMain from './layout-main.vue'

export const DouLayout = withInstall(Layout)
export const DouLayoutHeader = withInstall(LayoutHeader)
export const DouLayoutAside = withInstall(LayoutAside)
export const DouLayoutAsideTrigger = withInstall<typeof LayoutAsideTrigger, ButtonAttributes>(
  LayoutAsideTrigger,
)
export const DouLayoutMain = withInstall(LayoutMain)
export const DouLayoutFooter = withInstall(LayoutFooter)
export default DouLayout

export { layoutKey } from './layout'
export type * from './layout'
export type LayoutInstance = InstanceType<typeof Layout>
export type LayoutAsideInstance = InstanceType<typeof LayoutAside>

declare module 'vue' {
  export interface GlobalComponents {
    DouLayout: typeof DouLayout
    DouLayoutHeader: typeof DouLayoutHeader
    DouLayoutAside: typeof DouLayoutAside
    DouLayoutAsideTrigger: typeof DouLayoutAsideTrigger
    DouLayoutMain: typeof DouLayoutMain
    DouLayoutFooter: typeof DouLayoutFooter
  }
}
