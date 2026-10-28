import { withInstall } from '../../utils/install'
import Kbd from './kbd.vue'

export const DouKbd = withInstall(Kbd)
export default DouKbd

export type * from './kbd'
export type KbdInstance = InstanceType<typeof Kbd>

declare module 'vue' {
  export interface GlobalComponents {
    DouKbd: typeof DouKbd
  }
}
