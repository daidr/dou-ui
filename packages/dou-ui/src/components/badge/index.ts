import { withInstall } from '../../utils/install'
import Badge from './badge.vue'

export const DouBadge = withInstall(Badge)
export default DouBadge

export type * from './badge'
export type BadgeInstance = InstanceType<typeof Badge>

declare module 'vue' {
  export interface GlobalComponents {
    DouBadge: typeof DouBadge
  }
}
