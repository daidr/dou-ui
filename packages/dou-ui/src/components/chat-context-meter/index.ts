import { withInstall } from '../../utils/install'
import ChatContextMeter from './chat-context-meter.vue'

export const DouChatContextMeter = withInstall(ChatContextMeter)
export default DouChatContextMeter

export type * from './chat-context-meter'
export { compactNumber, contextUsage } from './chat-context-meter'
export type ChatContextMeterInstance = InstanceType<typeof ChatContextMeter>

declare module 'vue' {
  export interface GlobalComponents {
    DouChatContextMeter: typeof DouChatContextMeter
  }
}
