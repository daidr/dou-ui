/** The error values a formula can give. */
export const ERROR_CODES = [
  '#DIV/0!',
  '#N/A',
  '#NAME?',
  '#NULL!',
  '#NUM!',
  '#REF!',
  '#VALUE!',
  '#CYCLE!',
  '#ERROR!',
] as const

/**
 * - `#DIV/0!` dividing by zero
 * - `#N/A` a lookup found nothing
 * - `#NAME?` an unknown function or name
 * - `#NUM!` a number out of range
 * - `#REF!` a reference to cells or a sheet that are gone
 * - `#VALUE!` a value of the wrong kind, such as text in a sum of two cells
 * - `#CYCLE!` the formula depends on itself
 * - `#ERROR!` the text isn't a formula
 */
export type SheetErrorCode = (typeof ERROR_CODES)[number]

/** An error value; there is one of each, so they compare with `===`. */
export class SheetError {
  private constructor(readonly code: SheetErrorCode) {}

  static readonly all = new Map(ERROR_CODES.map((code) => [code, new SheetError(code)]))

  static of(code: SheetErrorCode): SheetError {
    return SheetError.all.get(code)!
  }

  toString() {
    return this.code
  }
}

export const isSheetError = (value: unknown): value is SheetError => value instanceof SheetError

export const DIV0 = SheetError.of('#DIV/0!')
export const NA = SheetError.of('#N/A')
export const NAME = SheetError.of('#NAME?')
export const NUM = SheetError.of('#NUM!')
export const REF = SheetError.of('#REF!')
export const VALUE = SheetError.of('#VALUE!')
export const CYCLE = SheetError.of('#CYCLE!')
export const SYNTAX = SheetError.of('#ERROR!')
