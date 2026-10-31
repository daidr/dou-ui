import { withInstall } from 'dou-ui'
import Sheet from './sheet.vue'
import SheetTabs from './components/sheet-tabs.vue'
import SheetToolbar from './components/sheet-toolbar.vue'

export const DouSheet = withInstall(Sheet)
export const DouSheetTabs = withInstall(SheetTabs)
export const DouSheetToolbar = withInstall(SheetToolbar)
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
  SheetFormatOption,
  SheetSlots,
  SheetToolbarProps,
  SheetToolbarSlots,
  SheetToolbarTool,
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
export { detectDelimiter, parseCSV, readCSV, sheetToCSV } from './core/csv'
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
export { changeDecimals, formatValue, parseInput } from './core/format'
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
  SheetStylePatch,
  SheetTransactionMeta,
} from './core/transaction'
export { criteriaOf, defineSheetFunction, numbersOf, scalarOf } from './formula/functions'
export { compareValues, dateText, serialOf, toBoolean, toNumber, toText } from './formula/values'
export type { SheetFunction, SheetFunctionContext } from './formula/functions'
export { isSheetError, SheetError } from './formula/error'
export type { SheetErrorCode } from './formula/error'
export type { SheetArg, SheetRangeArg, SheetResult } from './formula/values'
export { sheetLocales, useSheetMessages } from './locale'
export type { SheetMessages } from './locale'

declare module 'vue' {
  export interface GlobalComponents {
    DouSheet: typeof DouSheet
    DouSheetTabs: typeof DouSheetTabs
    DouSheetToolbar: typeof DouSheetToolbar
  }
}
