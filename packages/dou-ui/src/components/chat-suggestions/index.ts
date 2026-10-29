import { withInstall } from '../../utils/install'
import ChatSuggestions from './chat-suggestions.vue'

export const DouChatSuggestions = withInstall(ChatSuggestions)
export default DouChatSuggestions

export type * from './chat-suggestions'
export type ChatSuggestionsInstance = InstanceType<typeof ChatSuggestions>

declare module 'vue' {
  export interface GlobalComponents {
    DouChatSuggestions: typeof DouChatSuggestions
  }
}
