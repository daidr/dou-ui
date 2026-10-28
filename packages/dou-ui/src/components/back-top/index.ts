import { withInstall } from '../../utils/install'
import BackTop from './back-top.vue'

export const DouBackTop = withInstall(BackTop)
export default DouBackTop

export type * from './back-top'
export type BackTopInstance = InstanceType<typeof BackTop>

declare module 'vue' {
  export interface GlobalComponents {
    DouBackTop: typeof DouBackTop
  }
}
