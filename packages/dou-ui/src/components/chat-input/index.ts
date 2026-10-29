import { withInstall } from '../../utils/install'
import ChatInput from './chat-input.vue'

export const DouChatInput = withInstall(ChatInput)
export default DouChatInput

export type * from './chat-input'
export type ChatInputInstance = InstanceType<typeof ChatInput>

declare module 'vue' {
  export interface GlobalComponents {
    DouChatInput: typeof DouChatInput
  }
}
