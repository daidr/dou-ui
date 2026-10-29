import { withInstall } from '../../utils/install'
import ChatPlan from './chat-plan.vue'

export const DouChatPlan = withInstall(ChatPlan)
export default DouChatPlan

export type * from './chat-plan'
export type ChatPlanInstance = InstanceType<typeof ChatPlan>

declare module 'vue' {
  export interface GlobalComponents {
    DouChatPlan: typeof DouChatPlan
  }
}
