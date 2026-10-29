import { withInstall } from '../../utils/install'
import ChatList from './chat-list.vue'
import type { ChatListExpose } from './chat-list'

export const DouChatList = withInstall(ChatList)
export default DouChatList

export type * from './chat-list'
/** What a ref to the list gives; the component is generic, so it has no single instance type. */
export type ChatListInstance = ChatListExpose

declare module 'vue' {
  export interface GlobalComponents {
    DouChatList: typeof DouChatList
  }
}
