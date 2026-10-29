import { withInstall } from '../../utils/install'
import ChatList from './chat-list.vue'

export const DouChatList = withInstall(ChatList)
export default DouChatList

export type * from './chat-list'
export type ChatListInstance = InstanceType<typeof ChatList>

declare module 'vue' {
  export interface GlobalComponents {
    DouChatList: typeof DouChatList
  }
}
