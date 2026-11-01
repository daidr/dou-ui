/*
 * The spreadsheet without the grid: the workbook and its cells, changes
 * made with transactions, and reading and writing files with exporters and
 * importers. Nothing here loads Vue or the components, so it runs in a
 * Worker or on the server as it is.
 */
export {
  createFileSource,
  csvExporter,
  csvImporter,
  defineSheetExporter,
  defineSheetImporter,
  SheetFileError,
  exportWorkbook,
  readWorkbook,
} from './file'

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
} from './file'

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
} from './address'

export { detectDelimiter, parseCSV, readCSV, sheetToCSV } from './csv'
export type { SheetCSVReadOptions, SheetCSVWriteOptions } from './csv'

export type { SheetBounds, SheetCellTarget, SheetPoint, SheetRange, SheetRefMap } from './address'

export { defineSheetExtension } from './extension'
export type { SheetExtension, SheetUpdate } from './extension'
export { keepCommentAnchors, sheetCommentAnchors } from './comments'
export { diffWorkbooks, restoreWorkbook } from './versions'
export type { SheetCellChange, WorkbookDiff } from './versions'
export type { SheetCommentAnchor } from './comments'
export type { SheetClip } from './clipboard'
export type { SheetLabel } from './commands'
export { defineSheetCellType, optionOf } from './cell-type'
export type {
  SheetCellType,
  SheetDrawContext,
  SheetDrawRect,
  SheetDrawTextOptions,
  SheetResolvedType,
} from './cell-type'

export { cellOf, valueOf } from './model'
export { checkWorkbook, emptyWorkbook, migrateWorkbook } from './document'
export type { CheckWorkbookOptions, WorkbookProblem } from './document'

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
} from './model'

export { compareForSort, meetsRule, sortRows, textCollator } from './data'
export type { SheetSortKey } from './data'
export { changeDecimals, formatValue, parseInput } from './format'
export type { SheetInput } from './format'
export { lightThemeColor, plainStyle } from './paint'
export { sheetMessagesFor, sheetLocales } from '../locale'
export type { SheetFileMessages, SheetMessages } from '../locale'
export { checkProtection, isLocked, protectionOf } from './protect'
export { linkTarget } from './link'
export type { SheetLinkTarget } from './link'
export type { SheetProtectionCheck, SheetProtectionRefusal } from './protect'
export { applySheetSteps, compactSheetSteps, sheetKey, SheetTransaction } from './transaction'
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
} from './transaction'
