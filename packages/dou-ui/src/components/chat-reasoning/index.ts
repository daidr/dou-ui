import { withInstall } from '../../utils/install'
import ChatReasoning from './chat-reasoning.vue'

export const DouChatReasoning = withInstall(ChatReasoning)
export default DouChatReasoning

export type * from './chat-reasoning'
export type ChatReasoningInstance = InstanceType<typeof ChatReasoning>

declare module 'vue' {
  export interface GlobalComponents {
    DouChatReasoning: typeof DouChatReasoning
  }
}
