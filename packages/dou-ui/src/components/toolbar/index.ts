import { withInstall } from '../../utils/install'
import Toolbar from './toolbar.vue'
import ToolbarSeparator from './toolbar-separator.vue'

export const DouToolbar = withInstall(Toolbar)
export const DouToolbarSeparator = withInstall(ToolbarSeparator)
export default DouToolbar

export type * from './toolbar'
export type ToolbarInstance = InstanceType<typeof Toolbar>

declare module 'vue' {
  export interface GlobalComponents {
    DouToolbar: typeof DouToolbar
    DouToolbarSeparator: typeof DouToolbarSeparator
  }
}
