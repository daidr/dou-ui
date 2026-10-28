import { withInstall } from '../../utils/install'
import Pagination from './pagination.vue'

export const DouPagination = withInstall(Pagination)
export default DouPagination

export type * from './pagination'
export { paginationRange } from './range'
export type PaginationInstance = InstanceType<typeof Pagination>

declare module 'vue' {
  export interface GlobalComponents {
    DouPagination: typeof DouPagination
  }
}
