import { withInstall } from '../../utils/install'
import Descriptions from './descriptions.vue'
import DescriptionsItem from './descriptions-item.vue'

export const DouDescriptions = withInstall(Descriptions)
export const DouDescriptionsItem = withInstall(DescriptionsItem)
export default DouDescriptions

export type * from './descriptions'
export type DescriptionsInstance = InstanceType<typeof Descriptions>
export type DescriptionsItemInstance = InstanceType<typeof DescriptionsItem>

declare module 'vue' {
  export interface GlobalComponents {
    DouDescriptions: typeof DouDescriptions
    DouDescriptionsItem: typeof DouDescriptionsItem
  }
}
