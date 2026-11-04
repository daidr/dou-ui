import { withInstall } from '../../utils/install'
import { forwardsTrigger } from '../../utils/only-child'
import Tooltip from './tooltip.vue'

export const DouTooltip = withInstall(Tooltip)
// 默认插槽就是触发元素：套在另一个浮层外面时，属性转交给插槽
forwardsTrigger(Tooltip)
export default DouTooltip

export type * from './tooltip'
export type TooltipInstance = InstanceType<typeof Tooltip>

declare module 'vue' {
  export interface GlobalComponents {
    DouTooltip: typeof DouTooltip
  }
}
