import { withInstall } from '../../utils/install'
import InputTag from './input-tag.vue'

export const DouInputTag = withInstall(InputTag)
export default DouInputTag

export type * from './input-tag'
export type InputTagInstance = InstanceType<typeof InputTag>

declare module 'vue' {
  export interface GlobalComponents {
    DouInputTag: typeof DouInputTag
  }
}
