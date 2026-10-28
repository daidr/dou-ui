import { withInstall } from '../../utils/install'
import Card from './card.vue'

export const DouCard = withInstall(Card)
export default DouCard

export type * from './card'
export type CardInstance = InstanceType<typeof Card>

declare module 'vue' {
  export interface GlobalComponents {
    DouCard: typeof DouCard
  }
}
