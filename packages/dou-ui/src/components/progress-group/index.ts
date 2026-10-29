import { withInstall } from '../../utils/install'
import ProgressGroup from './progress-group.vue'

export const DouProgressGroup = withInstall(ProgressGroup)
export default DouProgressGroup

export type * from './progress-group'
export type ProgressGroupInstance = InstanceType<typeof ProgressGroup>

declare module 'vue' {
  export interface GlobalComponents {
    DouProgressGroup: typeof DouProgressGroup
  }
}
