import { withInstall } from 'dou-ui'
import GridLayout from './grid/grid-layout.vue'

export const DouGridLayout = withInstall(GridLayout)

export type {
  GridChangeEvent,
  GridChangeReason,
  GridDragEndEvent,
  GridDragEvent,
  GridItemSlotProps,
  GridLayoutEmits,
  GridLayoutExpose,
  GridLayoutProps,
  GridResizeHandle,
} from './grid/types'
export {
  compactLayout,
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
  }
}
