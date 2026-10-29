import type { App } from 'vue'
import { withInstall } from '../../utils/install'
import { vLoading } from './directive'
import Loading from './loading.vue'

export const DouLoading = withInstall(Loading)
const installLoading = DouLoading.install
// Installing the component also registers `v-loading`.
DouLoading.install = (app: App) => {
  installLoading?.(app)
  app.directive('loading', vLoading)
}
export default DouLoading

export { vLoading }
export type * from './loading'
export type LoadingInstance = InstanceType<typeof Loading>

declare module 'vue' {
  export interface GlobalComponents {
    DouLoading: typeof DouLoading
  }
  export interface GlobalDirectives {
    vLoading: typeof vLoading
  }
}
