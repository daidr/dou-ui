import { withInstall } from '../../utils/install'
import CheckTagGroup from './check-tag-group.vue'
import CheckTag from './check-tag.vue'

export const DouCheckTag = withInstall(CheckTag)
export const DouCheckTagGroup = withInstall(CheckTagGroup)
export default DouCheckTag

export type * from './check-tag'
export type CheckTagInstance = InstanceType<typeof CheckTag>
export type CheckTagGroupInstance = InstanceType<typeof CheckTagGroup>

declare module 'vue' {
  export interface GlobalComponents {
    DouCheckTag: typeof DouCheckTag
    DouCheckTagGroup: typeof DouCheckTagGroup
  }
}
