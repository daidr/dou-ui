import { shallowRef, toRaw, toValue, triggerRef, watch, type MaybeRefOrGetter } from 'vue'
import type { SheetCellTarget } from './core/address'
import type { SheetWorkbook } from './core/model'
import {
  SheetFormulaEngine,
  type SheetFormulaChange,
  type SheetFormulaEngineOptions,
} from './formula/engine'
import type { SheetResult } from './formula/values'

/** The results of a workbook's formulas, read reactively. */
export interface SheetFormulas {
  /**
   * A cell's result, as `SheetFormulaEngine.result` gives it. Read in a
   * `computed` or a template, it is read again when the workbook changes.
   */
  result: {
    (sheet: string | number, cell: SheetCellTarget): SheetResult
    (sheet: string | number, row: number, col: number): SheetResult
  }
  /** Works out a formula without writing it into a cell, reactively too. */
  evaluate: (formula: string, sheet?: string | number) => SheetResult
  /**
   * Catches up with a change of the grid: pass it the `transaction` event
   * (`@transaction="formulas.update"`), and only the formulas the change
   * reaches are worked out again. Without it, every change of the workbook
   * works all of them out again.
   */
  update: (change: SheetFormulaChange) => void
  /** The engine underneath. */
  readonly engine: SheetFormulaEngine
}

/**
 * Works out a workbook's formulas outside the grid, such as for totals
 * shown above it. `book` is the workbook bound to the grid's `v-model`.
 */
export function useSheetFormulas(
  book: MaybeRefOrGetter<SheetWorkbook>,
  options?: SheetFormulaEngineOptions,
): SheetFormulas {
  // the plain workbook: the grid's transactions start from it, not from a proxy
  const read = () => toRaw(toValue(book))
  const engine = shallowRef(new SheetFormulaEngine(read(), options))
  // a workbook the engine doesn't have yet (replaced from outside, or
  // changed without `update`): start over with it
  watch(read, (doc) => {
    if (doc === engine.value.doc) return
    engine.value.load(doc)
    triggerRef(engine)
  })
  return {
    result: ((sheet: string | number, at: SheetCellTarget | number, col?: number) =>
      typeof at === 'number'
        ? engine.value.result(sheet, at, col!)
        : engine.value.result(sheet, at)) as SheetFormulas['result'],
    evaluate: (formula, sheet) => engine.value.evaluate(formula, sheet),
    update: (change) => {
      engine.value.update(change)
      triggerRef(engine)
    },
    get engine() {
      return engine.value
    },
  }
}
