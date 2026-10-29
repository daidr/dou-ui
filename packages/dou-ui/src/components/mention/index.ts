import { withInstall } from '../../utils/install'
import Mention from './mention.vue'

export const DouMention = withInstall(Mention)
export default DouMention

export type * from './mention'
export type MentionInstance = InstanceType<typeof Mention>

declare module 'vue' {
  export interface GlobalComponents {
    DouMention: typeof DouMention
  }
}
