import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from 'vue'
import { withInstall } from '../../utils/install'
import Text from './text.vue'

// `as` 可以换成链接或按钮，这时也能写它们的属性
export const DouText = withInstall<typeof Text, AnchorHTMLAttributes & ButtonHTMLAttributes>(Text)
export default DouText

export type * from './text'
export type TextInstance = InstanceType<typeof Text>

declare module 'vue' {
  export interface GlobalComponents {
    DouText: typeof DouText
  }
}
