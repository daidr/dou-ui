import { withInstall } from '../../utils/install'
import Popover from './popover.vue'

export const DouPopover = withInstall(Popover)
export default DouPopover

export type * from './popover'
export type PopoverInstance = InstanceType<typeof Popover>

declare module 'vue' {
  export interface GlobalComponents {
    DouPopover: typeof DouPopover
  }
}
