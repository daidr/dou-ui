import { withInstall } from '../../utils/install'
import { forwardsTrigger } from '../../utils/only-child'
import Tooltip from './tooltip.vue'

export const DouTooltip = forwardsTrigger(withInstall(Tooltip))
export default DouTooltip

export type * from './tooltip'
export type TooltipInstance = InstanceType<typeof Tooltip>

declare module 'vue' {
  export interface GlobalComponents {
    DouTooltip: typeof DouTooltip
  }
}
