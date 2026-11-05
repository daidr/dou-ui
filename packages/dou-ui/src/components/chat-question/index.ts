import { withInstall } from '../../utils/install'
import ChatQuestion from './chat-question.vue'

export const DouChatQuestion = withInstall(ChatQuestion)
export default DouChatQuestion

export type * from './chat-question'
export type ChatQuestionInstance = InstanceType<typeof ChatQuestion>

declare module 'vue' {
  export interface GlobalComponents {
    DouChatQuestion: typeof DouChatQuestion
  }
}
