import { withInstall } from '../../utils/install'
import Countdown from './countdown.vue'

export const DouCountdown = withInstall(Countdown)
export default DouCountdown

export { formatDuration } from './format'
export { useCountdown } from './use-countdown'
export type { UseCountdownOptions } from './use-countdown'
export type * from './countdown'
export type CountdownInstance = InstanceType<typeof Countdown>

declare module 'vue' {
  export interface GlobalComponents {
    DouCountdown: typeof DouCountdown
  }
}
