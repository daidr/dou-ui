import { withInstall } from 'dou-ui'
import Pivot from './pivot.vue'
import PivotFields from './fields/fields.vue'
import type { PivotFieldsProps, PivotProps } from './types'

export const DouPivot = withInstall(Pivot)
export const DouPivotFields = withInstall(PivotFields)
export default DouPivot

export type {
  PivotCellEvent,
  PivotChartRows,
  PivotChartRowsOptions,
  PivotCopyOptions,
  PivotEmits,
  PivotExpose,
  PivotFieldsProps,
  PivotPrintOptions,
  PivotProps,
  PivotSheetCell,
  PivotSheetWorkbook,
} from './types'
export type { PivotCSVOptions, PivotGrid, PivotGridCell } from './core/table'
export type { PivotAxis } from './core/layout'
export {
  bucketer,
  computePivot,
  defineAggregator,
  PivotResult,
  PivotSource,
  PivotTree,
} from './engine'
export type {
  PivotAggregateName,
  PivotAggregator,
  PivotCollapsed,
  PivotComputeOptions,
  PivotConfig,
  PivotDimension,
  PivotField,
  PivotFieldType,
  PivotFilter,
  PivotFormat,
  PivotGroupBy,
  PivotLevel,
  PivotPath,
  PivotResolvedField,
  PivotResolvedValue,
  PivotSourceOptions,
  PivotValue,
  PivotValueSort,
} from './engine'
export { pivotLocales, usePivotMessages } from './locale'
export type { PivotMessages, PivotMessagesOverride } from './locale'

declare module 'vue' {
  export interface GlobalComponents {
    DouPivot: typeof DouPivot
    DouPivotFields: typeof DouPivotFields
  }
}

declare module 'dou-ui' {
  export interface GenericComponentProps {
    DouPivot: PivotProps
    DouPivotFields: PivotFieldsProps
  }
}
