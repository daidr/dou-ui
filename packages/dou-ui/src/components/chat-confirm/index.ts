import { withInstall } from '../../utils/install'
import ChatConfirm from './chat-confirm.vue'

export const DouChatConfirm = withInstall(ChatConfirm)
export default DouChatConfirm

export type * from './chat-confirm'
export type ChatConfirmInstance = InstanceType<typeof ChatConfirm>

declare module 'vue' {
  export interface GlobalComponents {
    DouChatConfirm: typeof DouChatConfirm
  }
}
