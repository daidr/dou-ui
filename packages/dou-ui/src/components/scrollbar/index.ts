import { withInstall } from '../../utils/install'
import Scrollbar from './scrollbar.vue'

export const DouScrollbar = withInstall(Scrollbar)
export default DouScrollbar

export type * from './scrollbar'
export type ScrollbarInstance = InstanceType<typeof Scrollbar>

declare module 'vue' {
  export interface GlobalComponents {
    DouScrollbar: typeof DouScrollbar
  }
}
