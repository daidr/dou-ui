import { withInstall } from '../../utils/install'
import Icon from './icon.vue'

export const DouIcon = withInstall(Icon)
export default DouIcon

export type * from './icon'
export type IconInstance = InstanceType<typeof Icon>

declare module 'vue' {
  export interface GlobalComponents {
    DouIcon: typeof DouIcon
  }
}
