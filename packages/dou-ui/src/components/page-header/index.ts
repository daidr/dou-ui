import { withInstall } from '../../utils/install'
import PageHeader from './page-header.vue'

export const DouPageHeader = withInstall(PageHeader)
export default DouPageHeader

export type * from './page-header'
export type PageHeaderInstance = InstanceType<typeof PageHeader>

declare module 'vue' {
  export interface GlobalComponents {
    DouPageHeader: typeof DouPageHeader
  }
}
