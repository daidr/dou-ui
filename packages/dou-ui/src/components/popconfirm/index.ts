import { withInstall } from '../../utils/install'
import { forwardsTrigger } from '../../utils/only-child'
import Popconfirm from './popconfirm.vue'

export const DouPopconfirm = forwardsTrigger(withInstall(Popconfirm))
export default DouPopconfirm

export type * from './popconfirm'
export type PopconfirmInstance = InstanceType<typeof Popconfirm>

declare module 'vue' {
  export interface GlobalComponents {
    DouPopconfirm: typeof DouPopconfirm
  }
}
