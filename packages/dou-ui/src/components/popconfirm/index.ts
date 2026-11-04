import { withInstall } from '../../utils/install'
import { forwardsTrigger } from '../../utils/only-child'
import Popconfirm from './popconfirm.vue'

export const DouPopconfirm = withInstall(Popconfirm)
// 默认插槽就是触发元素：套在另一个浮层外面时，属性转交给插槽
forwardsTrigger(Popconfirm)
export default DouPopconfirm

export type * from './popconfirm'
export type PopconfirmInstance = InstanceType<typeof Popconfirm>

declare module 'vue' {
  export interface GlobalComponents {
    DouPopconfirm: typeof DouPopconfirm
  }
}
