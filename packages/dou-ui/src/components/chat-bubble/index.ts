import { withInstall } from '../../utils/install'
import ChatBubble from './chat-bubble.vue'

export const DouChatBubble = withInstall(ChatBubble)
export default DouChatBubble

export type * from './chat-bubble'
export type ChatBubbleInstance = InstanceType<typeof ChatBubble>

declare module 'vue' {
  export interface GlobalComponents {
    DouChatBubble: typeof DouChatBubble
  }
}
