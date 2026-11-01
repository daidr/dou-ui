import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from 'vue'
import { withInstall } from '../../utils/install'
import Card from './card.vue'

// `as` 可以换成链接或按钮，这时也能写它们的属性
export const DouCard = withInstall<typeof Card, AnchorHTMLAttributes & ButtonHTMLAttributes>(Card)
export default DouCard

export type * from './card'
export type CardInstance = InstanceType<typeof Card>

declare module 'vue' {
  export interface GlobalComponents {
    DouCard: typeof DouCard
  }
}
