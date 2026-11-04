import { withInstall } from '../../utils/install'
import { forwardsTrigger } from '../../utils/only-child'
import Popover from './popover.vue'

export const DouPopover = withInstall(Popover)
// 默认插槽就是触发元素：套在另一个浮层外面时，属性转交给插槽
forwardsTrigger(Popover)
export default DouPopover

export type * from './popover'
export type PopoverInstance = InstanceType<typeof Popover>

declare module 'vue' {
  export interface GlobalComponents {
    DouPopover: typeof DouPopover
  }
}
