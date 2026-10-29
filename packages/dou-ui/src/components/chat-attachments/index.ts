import { withInstall } from '../../utils/install'
import ChatAttachments from './chat-attachments.vue'

export const DouChatAttachments = withInstall(ChatAttachments)
export default DouChatAttachments

export type * from './chat-attachments'
export type ChatAttachmentsInstance = InstanceType<typeof ChatAttachments>

declare module 'vue' {
  export interface GlobalComponents {
    DouChatAttachments: typeof DouChatAttachments
  }
}
