import { shiftFormula, type SheetBounds } from './address'
import { optionOf } from './cell-type'
import { boundsIn } from './conditional'
import { isEmptyValue, meetsCondition, textCollator } from './data'
import type { SheetSelectOption, SheetValidation, SheetValue } from './model'
import { format, type SheetMessages } from '../locale'

/*
 * Data validation: what the cells of a range may hold. A rule is checked
 * when a value is typed (a strict rule refuses it) and when cells are
 * drawn, where a value that doesn't fit gets a mark.
 */

/** Where the rules read cells and work out formulas, for the sheet they belong to. */
export interface SheetCheckSource {
  /** What a cell holds, its formula's result for a formula. */
  valueAt: (row: number, col: number) => unknown
  /** How a cell shows. */
  textAt: (row: number, col: number) => string
  /** Works out a formula on the sheet. */
  evaluate: (formula: string) => unknown
  /** The values of the cells a list refers to, such as `'=$H$2:$H$9'`. */
  listAt: (reference: string) => SheetValue[]
  size: { rows: number; cols: number }
  lang?: string
}

interface Rule {
  rule: SheetValidation
  bounds: SheetBounds
  options?: SheetSelectOption[]
}

/** Whether a rule reads other cells, so a cell's mark can change when they do. */
export const readsOthers = (rule: SheetValidation) =>
  'formula' in rule || ('list' in rule && typeof rule.list === 'string')

/** Two values are the same option: equal, or the same text without case. */
function sameOption(a: unknown, b: unknown) {
  if (a === b) return true
  return typeof a === 'string' && typeof b === 'string' && a.toLowerCase() === b.toLowerCase()
}

/**
 * The validation rules of a sheet. Make a new one when the workbook
 * changes; it reads a list's cells once.
 */
export class SheetChecks {
  private rules: Rule[] = []
  private collator: Intl.Collator

  constructor(
    validations: readonly SheetValidation[] | undefined,
    private source: SheetCheckSource,
  ) {
    this.collator = textCollator(source.lang)
    for (const rule of validations ?? []) {
      const bounds = boundsIn(rule.range, source.size)
      if (bounds && bounds.top <= bounds.bottom && bounds.left <= bounds.right)
        this.rules.push({ rule, bounds })
    }
  }

  /** Whether there are any rules. */
  get empty() {
    return !this.rules.length
  }

  /** Whether a rule covering the row reads other cells. */
  readsOthersIn(row: number) {
    return this.rules.some(
      (r) => row >= r.bounds.top && row <= r.bounds.bottom && readsOthers(r.rule),
    )
  }

  private entryAt(row: number, col: number) {
    for (const r of this.rules) {
      const b = r.bounds
      if (row >= b.top && row <= b.bottom && col >= b.left && col <= b.right) return r
    }
    return undefined
  }

  /** The rule a cell must keep, or `undefined`. */
  ruleAt(row: number, col: number): SheetValidation | undefined {
    return this.entryAt(row, col)?.rule
  }

  /** The options of the list rule a cell must keep, or `undefined` when it has none. */
  optionsAt(row: number, col: number): SheetSelectOption[] | undefined {
    const entry = this.entryAt(row, col)
    return entry && 'list' in entry.rule ? this.optionsOf(entry) : undefined
  }

  private optionsOf(entry: Rule) {
    const { list } = entry.rule as Extract<SheetValidation, { list: unknown }>
    if (!entry.options) {
      if (typeof list !== 'string') entry.options = list
      else {
        // a list's cells, without blanks or values given twice
        const seen: SheetValue[] = []
        for (const value of this.source.listAt(list))
          if (!isEmptyValue(value) && !seen.some((v) => sameOption(v, value))) seen.push(value)
        entry.options = seen
      }
    }
    return entry.options
  }

  /**
   * Whether a value fits the rule of the cell at `row`, `col`; `text` is how
   * it shows. Without a rule, anything fits.
   */
  fits(row: number, col: number, value: unknown, text: string) {
    const entry = this.entryAt(row, col)
    if (!entry || isEmptyValue(value)) return true
    const { rule } = entry
    if ('list' in rule)
      return this.optionsOf(entry).some((option) => sameOption(optionOf(option).value, value))
    if ('when' in rule) {
      const { when } = rule
      if (rule.integer || typeof when.value === 'number' || typeof when.to === 'number') {
        if (typeof value !== 'number') return false
        if (rule.integer && !Number.isInteger(value)) return false
      }
      return meetsCondition(when, value, text, this.collator)
    }
    const formula = shiftFormula(rule.formula, row - entry.bounds.top, col - entry.bounds.left)
    const result = this.source.evaluate(formula)
    return result === true || (typeof result === 'number' && result !== 0)
  }

  /** The rule a cell breaks as it is now, or `undefined`. */
  brokenAt(row: number, col: number): SheetValidation | undefined {
    const rule = this.ruleAt(row, col)
    if (!rule) return undefined
    const s = this.source
    return this.fits(row, col, s.valueAt(row, col), s.textAt(row, col)) ? undefined : rule
  }

  /** Every cell that breaks its rule, rule by rule. */
  *broken(): Generator<{ row: number; col: number; rule: SheetValidation }> {
    const seen = new Set<number>()
    for (const { bounds: b } of this.rules)
      for (let row = b.top; row <= b.bottom; row++)
        for (let col = b.left; col <= b.right; col++) {
          const pos = row * 16384 + col
          if (seen.has(pos)) continue
          seen.add(pos)
          const rule = this.brokenAt(row, col)
          if (rule) yield { row, col, rule }
        }
  }
}

const shown = (value: SheetValue | undefined) => (value == null ? '' : String(value))

/** A rule in words: its `message`, or what it asks for. */
export function ruleMessage(rule: SheetValidation, messages: SheetMessages) {
  if (rule.message) return rule.message
  const m = messages.validation
  if ('list' in rule) return m.list
  if ('formula' in rule) return format(m.formulaFailed, { formula: rule.formula })
  const { op, value, to } = rule.when
  const number = rule.integer || typeof value === 'number' || typeof to === 'number'
  if (op === 'notBlank' && number) return rule.integer ? m.integerOnly : m.numberOnly
  const between = op === 'between' || op === 'notBetween'
  const cond = format(between ? m.condBetween : m.cond, {
    op: messages.ops[op],
    value: shown(value),
    to: shown(to),
  }).trim()
  return format(rule.integer ? m.integer : number ? m.number : m.text, { cond })
}
