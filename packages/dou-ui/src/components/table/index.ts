import type { TableProps } from './table'
import { withInstall } from '../../utils/install'
import Table from './table.vue'

export const DouTable = withInstall(Table)
export default DouTable

export type * from './table'

declare module 'vue' {
  export interface GlobalComponents {
    DouTable: typeof DouTable
  }
}

declare module '../config-provider/config-provider' {
  export interface GenericComponentProps {
    DouTable: TableProps
  }
}
