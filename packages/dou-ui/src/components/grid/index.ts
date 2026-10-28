import { withInstall } from '../../utils/install'
import Grid from './grid.vue'
import GridItem from './grid-item.vue'

export const DouGrid = withInstall(Grid)
export const DouGridItem = withInstall(GridItem)
export default DouGrid

export type * from './grid'
export type GridInstance = InstanceType<typeof Grid>
export type GridItemInstance = InstanceType<typeof GridItem>

declare module 'vue' {
  export interface GlobalComponents {
    DouGrid: typeof DouGrid
    DouGridItem: typeof DouGridItem
  }
}
