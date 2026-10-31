import { withInstall } from 'dou-ui'
import GridLayout from './grid/grid-layout.vue'
import GridLayoutHandle from './grid/grid-handle.vue'
import Dashboard from './dashboard/dashboard.vue'
import DashboardPalette from './dashboard/palette.vue'

export const DouGridLayout = withInstall(GridLayout)
export const DouGridLayoutHandle = withInstall(GridLayoutHandle)
export const DouDashboard = withInstall(Dashboard)
export const DouDashboardPalette = withInstall(DashboardPalette)

export type {
  DashboardAddOptions,
  DashboardEmits,
  DashboardExpose,
  DashboardPaletteProps,
  DashboardProps,
} from './dashboard/types'
export type { DashboardDocument, DashboardPlace, DashboardWidget } from './core/types'
export { checkDocument, isDashboardPlace, migrateDocument } from './core/document'
export type { CheckDocumentOptions, DocumentProblem } from './core/document'
export { applySteps, DashboardTransaction, sameValue } from './core/transaction'
export type {
  DashboardStep,
  DashboardTransactionMeta,
  DashboardWidgetPatch,
} from './core/transaction'
export { DashboardHistory } from './core/history'
export { defineDashboardWidget } from './widget/define'
export type { DashboardWidgetSize, DashboardWidgetType } from './widget/define'
export { useDashboardWidget } from './widget/context'
export type {
  DashboardWidgetContext,
  DashboardWidgetState,
  DashboardWidgetStatus,
} from './widget/context'

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
    DouDashboard: typeof DouDashboard
    DouDashboardPalette: typeof DouDashboardPalette
  }
}
