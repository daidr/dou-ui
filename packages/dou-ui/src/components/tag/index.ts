import { withInstall } from '../../utils/install'
import Tag from './tag.vue'

export const DouTag = withInstall(Tag)
export default DouTag

export type * from './tag'
export type TagInstance = InstanceType<typeof Tag>

declare module 'vue' {
  export interface GlobalComponents {
    DouTag: typeof DouTag
  }
}
