import { withInstall } from 'dou-ui'
import Sheet from './sheet.vue'
import SheetTabs from './components/sheet-tabs.vue'
import SheetToolbar from './components/sheet-toolbar.vue'
import SheetFormulaBar from './components/sheet-formula-bar.vue'

export const DouSheet = withInstall(Sheet)
export const DouSheetTabs = withInstall(SheetTabs)
export const DouSheetToolbar = withInstall(SheetToolbar)
export const DouSheetFormulaBar = withInstall(SheetFormulaBar)
export default DouSheet

export { useSheet, sheetContextKey } from './context'
export { useSheetFormulas } from './formulas'
export type { SheetFormulas } from './formulas'
export type {
  SheetContext,
  SheetEditInputOptions,
  SheetEditorContext,
  SheetRangeRect,
  SheetRect,
} from './context'
export { defineSheetExtension, resolveSheetExtensions } from './core/extension'
export type {
  ResolvedSheetExtensions,
  SheetExtension,
  SheetExtensionContext,
  SheetCommentsProvider,
  SheetHistoryHandler,
  SheetKeyHandler,
  SheetUpdate,
} from './core/extension'
export { keepCommentAnchors, sheetCommentAnchors } from './core/comments'
export { diffWorkbooks, restoreWorkbook } from './core/versions'
export type { SheetCellChange, WorkbookDiff } from './core/versions'
export type { SheetCommentAnchor } from './core/comments'
export { defineSheetCommand } from './core/commands'
export {
  createFileSource,
  csvExporter,
  csvImporter,
  defineSheetExporter,
  defineSheetImporter,
  SheetFileError,
  exportWorkbook,
  readWorkbook,
} from './core/file'
export type {
  SheetCSVExportOptions,
  SheetExporter,
  SheetExporterInfo,
  SheetExportScope,
  SheetExportWorkbookOptions,
  SheetFileSheet,
  SheetFileSource,
  SheetFileSourceOptions,
  SheetFileView,
  SheetImportContext,
  SheetImporter,
  SheetImporterInfo,
  SheetImportResult,
  SheetImportWarning,
  SheetReadWorkbookOptions,
} from './core/file'
export type { SheetCommand, SheetCommandInfo, SheetCommands, SheetLabel } from './core/commands'
export { defineSheetCellType, optionOf, resolveCellType } from './core/cell-type'
export type {
  SheetCellPanelExpose,
  SheetCellPanelProps,
  SheetCellRenderProps,
  SheetCellType,
  SheetDrawContext,
  SheetDrawRect,
  SheetDrawTextOptions,
  SheetResolvedType,
} from './core/cell-type'
export type {
  SheetEmits,
  SheetFormatOption,
  SheetSlots,
  SheetToolbarProps,
  SheetToolbarSlots,
  SheetToolbarTool,
  SheetToolbarItem,
  SheetExpose,
  SheetExportFileOptions,
  SheetExporterOptions,
  SheetExporterOptionsOf,
  SheetFileErrorEvent,
  SheetSaveFileOptions,
  SheetImportEvent,
  SheetImportMode,
  SheetImportFileOptions,
  SheetInvalidCell,
  SheetExportOptions,
  SheetImageOptions,
  SheetPrintOptions,
  SheetMenuContext,
  SheetMenuItem,
  SheetLinkOpenEvent,
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
  renameReferencesAll,
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
  SheetColor,
  SheetCondition,
  SheetConditionalAverage,
  SheetConditionalBar,
  SheetConditionalDuplicates,
  SheetConditionalFormat,
  SheetConditionalFormula,
  SheetConditionalRank,
  SheetConditionalScale,
  SheetConditionalStyle,
  SheetConditionalUnique,
  SheetConditionalWhen,
  SheetData,
  SheetFilter,
  SheetFilterRule,
  SheetFreeze,
  SheetProtection,
  SheetRow,
  SheetRuleRange,
  SheetSelectOption,
  SheetSortOrder,
  SheetStyle,
  SheetTypeSetup,
  SheetValidation,
  SheetValidationFormula,
  SheetValidationList,
  SheetValidationWhen,
  SheetValue,
  SheetWorkbook,
} from './core/model'
export { compareForSort, meetsRule, sortRows, textCollator } from './core/data'
export type { SheetSortKey } from './core/data'
export { changeDecimals, formatValue, parseInput } from './core/format'
export type { SheetInput } from './core/format'
export { isSelected, selectCell } from './core/selection'
export type { SheetSelection } from './core/selection'
export { checkProtection, isLocked, protectionOf } from './core/protect'
export { linkTarget } from './core/link'
export type { SheetLinkTarget } from './core/link'
export type { SheetProtectionCheck, SheetProtectionRefusal } from './core/protect'
export { applySheetSteps, compactSheetSteps, sheetKey, SheetTransaction } from './core/transaction'
export type {
  SheetAction,
  SheetAxisName,
  SheetCellAt,
  SheetLinesAt,
  SheetBookPatch,
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
export { sheetMessagesFor, sheetLocales } from './locale'
export { useSheetMessages } from './use-messages'
export type {
  SheetCommentMessages,
  SheetCompareMessages,
  SheetFileMessages,
  SheetMessages,
} from './locale'

declare module 'vue' {
  export interface GlobalComponents {
    DouSheet: typeof DouSheet
    DouSheetTabs: typeof DouSheetTabs
    DouSheetToolbar: typeof DouSheetToolbar
    DouSheetFormulaBar: typeof DouSheetFormulaBar
  }
}
export type { DrawCell, DrawLook, DrawTheme, SheetDrawing } from './export/draw'
export { lightThemeColor, plainStyle } from './core/paint'
