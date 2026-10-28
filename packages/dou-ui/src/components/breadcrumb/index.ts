import { withInstall } from '../../utils/install'
import Breadcrumb from './breadcrumb.vue'

export const DouBreadcrumb = withInstall(Breadcrumb)
export default DouBreadcrumb

export type * from './breadcrumb'
export type BreadcrumbInstance = InstanceType<typeof Breadcrumb>

declare module 'vue' {
  export interface GlobalComponents {
    DouBreadcrumb: typeof DouBreadcrumb
  }
}
