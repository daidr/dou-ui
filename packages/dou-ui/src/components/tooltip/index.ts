import { withInstall } from '../../utils/install'
import Tooltip from './tooltip.vue'

export const DouTooltip = withInstall(Tooltip)
export default DouTooltip

export type * from './tooltip'
export type TooltipInstance = InstanceType<typeof Tooltip>

declare module 'vue' {
  export interface GlobalComponents {
    DouTooltip: typeof DouTooltip
  }
}
