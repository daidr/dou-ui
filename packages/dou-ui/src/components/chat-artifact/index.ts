import { withInstall } from '../../utils/install'
import ChatArtifact from './chat-artifact.vue'

export const DouChatArtifact = withInstall(ChatArtifact)
export default DouChatArtifact

export type * from './chat-artifact'
export type ChatArtifactInstance = InstanceType<typeof ChatArtifact>

declare module 'vue' {
  export interface GlobalComponents {
    DouChatArtifact: typeof DouChatArtifact
  }
}
