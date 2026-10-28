import { withInstall } from '../../utils/install'
import TreeSelect from './tree-select.vue'

export const DouTreeSelect = withInstall(TreeSelect)
export default DouTreeSelect

export type * from './tree-select'
export type TreeSelectInstance = InstanceType<typeof TreeSelect>

declare module 'vue' {
  export interface GlobalComponents {
    DouTreeSelect: typeof DouTreeSelect
  }
}
