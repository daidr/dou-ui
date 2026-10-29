import { withInstall } from '../../utils/install'
import ChatCitation from './chat-citation.vue'
import ChatSources from './chat-sources.vue'

export const DouChatSources = withInstall(ChatSources)
export const DouChatCitation = withInstall(ChatCitation)
export default DouChatSources

export type * from './chat-sources'
export type ChatSourcesInstance = InstanceType<typeof ChatSources>
export type ChatCitationInstance = InstanceType<typeof ChatCitation>

declare module 'vue' {
  export interface GlobalComponents {
    DouChatSources: typeof DouChatSources
    DouChatCitation: typeof DouChatCitation
  }
}
