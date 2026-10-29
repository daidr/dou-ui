import { withInstall } from '../../utils/install'
import ChatSteps from './chat-steps.vue'

export const DouChatSteps = withInstall(ChatSteps)
export default DouChatSteps

export type * from './chat-steps'
export type ChatStepsInstance = InstanceType<typeof ChatSteps>

declare module 'vue' {
  export interface GlobalComponents {
    DouChatSteps: typeof DouChatSteps
  }
}
