import { withInstall } from '../../utils/install'
import Text from './text.vue'

export const DouText = withInstall(Text)
export default DouText

export type * from './text'
export type TextInstance = InstanceType<typeof Text>

declare module 'vue' {
  export interface GlobalComponents {
    DouText: typeof DouText
  }
}
