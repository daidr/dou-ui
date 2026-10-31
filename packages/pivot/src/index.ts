import { withInstall } from 'dou-ui'
import Pivot from './pivot.vue'

export const DouPivot = withInstall(Pivot)
export default DouPivot

export type { PivotCellEvent, PivotEmits, PivotExpose, PivotProps } from './types'
export type { PivotAxis } from './core/layout'
export { computePivot, defineAggregator, PivotResult, PivotSource, PivotTree } from './engine'
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
  }
}
