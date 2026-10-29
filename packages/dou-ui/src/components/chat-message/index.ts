import { withInstall } from '../../utils/install'
import ChatMessage from './chat-message.vue'

export const DouChatMessage = withInstall(ChatMessage)
export default DouChatMessage

export type * from './chat-message'
export type ChatMessageInstance = InstanceType<typeof ChatMessage>

declare module 'vue' {
  export interface GlobalComponents {
    DouChatMessage: typeof DouChatMessage
  }
}
