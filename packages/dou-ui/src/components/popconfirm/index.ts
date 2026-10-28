import { withInstall } from '../../utils/install'
import Popconfirm from './popconfirm.vue'

export const DouPopconfirm = withInstall(Popconfirm)
export default DouPopconfirm

export type * from './popconfirm'
export type PopconfirmInstance = InstanceType<typeof Popconfirm>

declare module 'vue' {
  export interface GlobalComponents {
    DouPopconfirm: typeof DouPopconfirm
  }
}
