import { withInstall } from '../../utils/install'
import ChatToolCall from './chat-tool-call.vue'

export const DouChatToolCall = withInstall(ChatToolCall)
export default DouChatToolCall

export type * from './chat-tool-call'
export type ChatToolCallInstance = InstanceType<typeof ChatToolCall>

declare module 'vue' {
  export interface GlobalComponents {
    DouChatToolCall: typeof DouChatToolCall
  }
}
