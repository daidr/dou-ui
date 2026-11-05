import { withInstall } from 'dou-ui'
import GridLayout from './grid/grid-layout.vue'
import GridLayoutHandle from './grid/grid-handle.vue'
import Dashboard from './dashboard/dashboard.vue'
import DashboardPalette from './dashboard/palette.vue'
import DashboardFilterBar from './dashboard/filter-bar.vue'

export const DouGridLayout = withInstall(GridLayout)
export const DouGridLayoutHandle = withInstall(GridLayoutHandle)
export const DouDashboard = withInstall(Dashboard)
export const DouDashboardPalette = withInstall(DashboardPalette)
export const DouDashboardFilterBar = withInstall(DashboardFilterBar)

export type {
  DashboardAddOptions,
  DashboardEmits,
  DashboardExportErrorEvent,
  DashboardWidgetErrorEvent,
  DashboardExportOptions,
  DashboardSaveOptions,
  DashboardCommentAnchor,
  DashboardExpose,
  DashboardFilterBarProps,
  DashboardPaletteProps,
  DashboardProps,
} from './dashboard/types'
export type { DashboardDocument, DashboardPlace, DashboardWidget } from './core/types'
export { checkDocument, emptyDocument, isDashboardPlace, migrateDocument } from './core/document'
export type { CheckDocumentOptions, DocumentProblem } from './core/document'
export { applySteps, DashboardTransaction, replaceWidgets, sameValue } from './core/transaction'
export type { ReplaceWidgetsOptions } from './core/transaction'
export type {
  DashboardCollaboration,
  DashboardCollaborationHost,
  DashboardPeer,
  DashboardPresence,
  DashboardPresenceAction,
} from './core/collaboration'
export type {
  DashboardStep,
  DashboardTransactionMeta,
  DashboardWidgetPatch,
} from './core/transaction'
export { DashboardHistory } from './core/history'
export { defineDashboardWidget } from './widget/define'
export type { DashboardWidgetSize, DashboardWidgetType } from './widget/define'
export { useDashboardWidget } from './widget/context'
export { isEmptyFilter } from './data/filters'
export type { DashboardImageOptions } from './dashboard/export'
export type {
  DashboardDateRangeFilterField,
  DashboardFilterField,
  DashboardFilters,
  DashboardLinkedFilter,
  DashboardSearchFilterField,
  DashboardSelectFilterField,
  DashboardSetFilterOptions,
  DashboardSourceContext,
  DashboardSourceLoad,
  DashboardSourceOptions,
  DashboardSources,
} from './data/types'
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
    DouDashboardFilterBar: typeof DouDashboardFilterBar
  }
}
