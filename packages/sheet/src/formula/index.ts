/*
 * The formula engine on its own, without the grid: read formulas, work
 * them out over a workbook, and add functions.
 */
export { SheetFormulaEngine } from './engine'
export type { SheetFormulaEngineOptions } from './engine'
export { ERROR_CODES, isSheetError, SheetError } from './error'
export type { SheetErrorCode } from './error'
export { builtinFunctions, criteriaOf, defineSheetFunction, numbersOf, scalarOf } from './functions'
export type { SheetFunction, SheetFunctionContext } from './functions'
export { functionsOf, parseFormula, referencesOf, SheetFormulaSyntaxError } from './parse'
export type { BinaryOp, SheetFormulaNode } from './parse'
export {
  compareValues,
  dateText,
  isDateText,
  isRange,
  serialOf,
  shownValue,
  toBoolean,
  toNumber,
  toText,
} from './values'
export type { SheetArg, SheetRangeArg, SheetResult } from './values'
