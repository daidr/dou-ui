import { withInstall } from 'dou-ui'
import GridLayout from './grid/grid-layout.vue'
import GridLayoutHandle from './grid/grid-handle.vue'

export const DouGridLayout = withInstall(GridLayout)
export const DouGridLayoutHandle = withInstall(GridLayoutHandle)

export type {
  GridChangeEvent,
  GridChangeReason,
  GridDragEndEvent,
  GridDragEvent,
  GridDropEvent,
  GridDropItem,
  GridItemSlotProps,
  GridLayoutEmits,
  GridLayoutExpose,
  GridLayoutProps,
  GridLayouts,
  GridPlace,
  GridResizeHandle,
} from './grid/types'
export {
  compactLayout,
  deriveLayout,
  findPlace,
  fitItem,
  layoutHeight,
  moveItem,
  moveItemBy,
  normalizeLayout,
  overlaps,
  resizeItem,
  resizeItemBy,
} from './layout'
export type { GridCompact, GridItem, GridLayoutOptions, GridPosition, GridSize } from './layout'
export { dashboardLocales, useDashboardMessages } from './locale'
export type { DashboardMessages, DashboardMessagesOverride } from './locale'

declare module 'vue' {
  export interface GlobalComponents {
    DouGridLayout: typeof DouGridLayout
    DouGridLayoutHandle: typeof DouGridLayoutHandle
  }
}
