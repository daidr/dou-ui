import { withInstall } from '../../utils/install'
import StreamText from './stream-text.vue'

export const DouStreamText = withInstall(StreamText)
export default DouStreamText

export type * from './stream-text'
export type StreamTextInstance = InstanceType<typeof StreamText>

declare module 'vue' {
  export interface GlobalComponents {
    DouStreamText: typeof DouStreamText
  }
}
