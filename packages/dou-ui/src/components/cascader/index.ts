import { withInstall } from '../../utils/install'
import Cascader from './cascader.vue'

export const DouCascader = withInstall(Cascader)
export default DouCascader

export type * from './cascader'
export type CascaderInstance = InstanceType<typeof Cascader>

declare module 'vue' {
  export interface GlobalComponents {
    DouCascader: typeof DouCascader
  }
}
