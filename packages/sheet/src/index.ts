import { withInstall } from 'dou-ui'
import Sheet from './sheet.vue'

export const DouSheet = withInstall(Sheet)
export default DouSheet

export type { SheetEmits, SheetExpose, SheetProps } from './types'
export {
  boundsOf,
  columnIndex,
  columnName,
  formatCell,
  formatRange,
  parseCell,
  parseRange,
  splitSheet,
} from './core/address'
export type { SheetBounds, SheetCellTarget, SheetPoint, SheetRange } from './core/address'
export { cellOf, valueOf } from './core/model'
export type {
  SheetCell,
  SheetCellInput,
  SheetData,
  SheetFreeze,
  SheetRow,
  SheetStyle,
  SheetValue,
  SheetWorkbook,
} from './core/model'
export { formatValue, parseInput } from './core/format'
export type { SheetInput } from './core/format'
export { isSelected, selectCell } from './core/selection'
export type { SheetSelection } from './core/selection'
export { applySheetSteps, compactSheetSteps, sheetKey, SheetTransaction } from './core/transaction'
export type {
  SheetCellAt,
  SheetPatch,
  SheetRangeAt,
  SheetRef,
  SheetStep,
  SheetTransactionMeta,
} from './core/transaction'
export { sheetLocales, useSheetMessages } from './locale'
export type { SheetMessages } from './locale'

declare module 'vue' {
  export interface GlobalComponents {
    DouSheet: typeof DouSheet
  }
}
