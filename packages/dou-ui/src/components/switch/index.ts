import { withInstall } from '../../utils/install'
import Switch from './switch.vue'

export const DouSwitch = withInstall(Switch)
export default DouSwitch

export type * from './switch'

declare module 'vue' {
  export interface GlobalComponents {
    DouSwitch: typeof DouSwitch
  }
}
