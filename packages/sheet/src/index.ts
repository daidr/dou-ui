import { withInstall } from 'dou-ui'
import Sheet from './sheet.vue'
import SheetTabs from './components/sheet-tabs.vue'

export const DouSheet = withInstall(Sheet)
export const DouSheetTabs = withInstall(SheetTabs)
export default DouSheet

export { useSheet, sheetContextKey } from './context'
export type { SheetContext, SheetRect } from './context'
export { defineSheetExtension, resolveSheetExtensions } from './core/extension'
export type {
  ResolvedSheetExtensions,
  SheetExtension,
  SheetExtensionContext,
  SheetKeyHandler,
} from './core/extension'
export { defineSheetCellType, optionOf, resolveCellType } from './core/cell-type'
export type {
  SheetCellPanelExpose,
  SheetCellPanelProps,
  SheetCellRenderProps,
  SheetCellType,
  SheetResolvedType,
} from './core/cell-type'
export type {
  SheetEmits,
  SheetSlots,
  SheetExpose,
  SheetMenuContext,
  SheetMenuItem,
  SheetPasteEvent,
  SheetProps,
} from './types'
export {
  boundsOf,
  columnIndex,
  columnName,
  formatCell,
  formatRange,
  moveReferences,
  dropReferences,
  renameReferences,
  parseCell,
  parseRange,
  quoteSheet,
  shiftFormula,
  splitSheet,
} from './core/address'
export { formatClip, parseClip, parseTSV } from './core/clipboard'
export { detectDelimiter, parseCSV, readCSV, sheetFromCSV, sheetToCSV } from './core/csv'
export type { SheetCSVReadOptions, SheetCSVWriteOptions } from './core/csv'
export type { SheetClip, SheetClipFormat } from './core/clipboard'
export { continueValues, fillContinues } from './core/fill'
export type { SheetFillMode, SheetFillOptions } from './core/fill'
export type {
  SheetBounds,
  SheetCellTarget,
  SheetPoint,
  SheetRange,
  SheetRefMap,
} from './core/address'
export { cellOf, valueOf } from './core/model'
export type {
  SheetCell,
  SheetCellInput,
  SheetData,
  SheetFreeze,
  SheetRow,
  SheetSelectOption,
  SheetStyle,
  SheetTypeSetup,
  SheetValue,
  SheetWorkbook,
} from './core/model'
export { formatValue, parseInput } from './core/format'
export type { SheetInput } from './core/format'
export { isSelected, selectCell } from './core/selection'
export type { SheetSelection } from './core/selection'
export { applySheetSteps, compactSheetSteps, sheetKey, SheetTransaction } from './core/transaction'
export type {
  SheetAction,
  SheetAxisName,
  SheetCellAt,
  SheetLinesAt,
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
    DouSheetTabs: typeof DouSheetTabs
  }
}
