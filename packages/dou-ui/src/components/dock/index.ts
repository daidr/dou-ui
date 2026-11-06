import { withInstall } from '../../utils/install'
import Dock from './dock.vue'

export const DouDock = withInstall(Dock)
export default DouDock

export type * from './dock'
export {
  dockGroups,
  findDockGroup,
  moveDockTab,
  nextDockGroupId,
  removeDockTab,
  selectDockTab,
  splitDockTab,
} from './layout'
export type DockInstance = InstanceType<typeof Dock>

declare module 'vue' {
  export interface GlobalComponents {
    DouDock: typeof DouDock
  }
}
