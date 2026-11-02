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
  checkPivotFormula,
  computePivot,
  defineAggregator,
  parsePivotFormula,
  PivotFormulaError,
  PivotResult,
  PivotSource,
  PivotTree,
} from './engine'
export type {
  PivotAggregateName,
  PivotAggregator,
  PivotCollapsed,
  PivotColumns,
  PivotComputeOptions,
  PivotComputeRequest,
  PivotConfig,
  PivotData,
  PivotDimension,
  PivotField,
  PivotFieldType,
  PivotFilter,
  PivotEngine,
  PivotFormat,
  PivotFormula,
  PivotFormulaErrorCode,
  PivotGroupBy,
  PivotLevel,
  PivotMark,
  PivotPacket,
  PivotPath,
  PivotRangeFilter,
  PivotResolvedField,
  PivotResolvedValue,
  PivotShow,
  PivotShowAs,
  PivotSourceOptions,
  PivotTone,
  PivotTopFilter,
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
