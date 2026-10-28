import { withInstall } from '../../utils/install'
import Tree from './tree.vue'

export const DouTree = withInstall(Tree)
export default DouTree

export type * from './tree'
export { treeRowHeights } from './tree'
export type TreeInstance = InstanceType<typeof Tree>

declare module 'vue' {
  export interface GlobalComponents {
    DouTree: typeof DouTree
  }
}
