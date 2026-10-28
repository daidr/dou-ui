import { withInstall } from '../../utils/install'
import SegmentedControl from './segmented-control.vue'

export const DouSegmentedControl = withInstall(SegmentedControl)
export default DouSegmentedControl

export type * from './segmented-control'
export type SegmentedControlInstance = InstanceType<typeof SegmentedControl>

declare module 'vue' {
  export interface GlobalComponents {
    DouSegmentedControl: typeof DouSegmentedControl
  }
}
