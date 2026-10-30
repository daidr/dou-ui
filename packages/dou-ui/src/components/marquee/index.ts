import { withInstall } from '../../utils/install'
import Marquee from './marquee.vue'

export const DouMarquee = withInstall(Marquee)
export default DouMarquee

export type * from './marquee'
export type MarqueeInstance = InstanceType<typeof Marquee>

declare module 'vue' {
  export interface GlobalComponents {
    DouMarquee: typeof DouMarquee
  }
}
