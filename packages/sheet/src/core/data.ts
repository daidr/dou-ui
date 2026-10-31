import type { SheetFilterCondition, SheetFilterRule, SheetSortOrder } from './model'

/*
 * Sorting and filtering rows by their values. The grid hands in what each
 * cell comes to (a formula's result) and how it shows; these only compare.
 */

/** One column to sort by, the first deciding most. */
export interface SheetSortKey {
  /** The column, by number. */
  col: number
  order?: SheetSortOrder
}

/** Kinds of values, in the order they sort in: numbers, text, false and true, errors. */
function rankOf(value: unknown) {
  if (typeof value === 'number') return 0
  if (typeof value === 'string') return 1
  if (typeof value === 'boolean') return 2
  return 3
}

/** Whether a value counts as empty: empty cells sort last, either way. */
export const isEmptyValue = (value: unknown) => value == null || value === ''

const collators = new Map<string, Intl.Collator>()
/** Compares text the way people of `lang` read it: numbers inside by size, case ignored. */
export function textCollator(lang?: string) {
  const key = lang ?? ''
  let collator = collators.get(key)
  if (!collator) {
    collator = new Intl.Collator(lang, { numeric: true, sensitivity: 'base' })
    collators.set(key, collator)
  }
  return collator
}

/**
 * Compares two values for sorting from small to large: numbers first, then
 * text, then `FALSE` and `TRUE`, then errors. Empty values are not compared
 * here; they go last whatever the order.
 */
export function compareForSort(a: unknown, b: unknown, collator = textCollator()) {
  const ra = rankOf(a)
  const rb = rankOf(b)
  if (ra !== rb) return ra - rb
  if (ra === 0) return (a as number) - (b as number)
  if (ra === 1) return collator.compare(a as string, b as string)
  if (ra === 2) return Number(a) - Number(b)
  return 0
}

/**
 * The order to put rows in, sorted by `keys`: a list of the given rows.
 * Equal rows keep their order; empty values go last in either order.
 */
export function sortRows(
  rows: readonly number[],
  keys: readonly SheetSortKey[],
  valueAt: (row: number, col: number) => unknown,
  collator = textCollator(),
): number[] {
  // read every value once
  const values = keys.map((key) => rows.map((row) => valueAt(row, key.col)))
  const order = rows.map((_, i) => i)
  // oxlint-disable-next-line unicorn/no-array-sort -- sorts a fresh array
  order.sort((x, y) => {
    for (const [k, key] of keys.entries()) {
      const a = values[k]![x]
      const b = values[k]![y]
      const ea = isEmptyValue(a)
      const eb = isEmptyValue(b)
      if (ea || eb) {
        if (ea !== eb) return ea ? 1 : -1
        continue
      }
      const c = compareForSort(a, b, collator)
      if (c) return key.order === 'desc' ? -c : c
    }
    return x - y
  })
  return order.map((i) => rows[i]!)
}

/** A number a filter condition can compare with, or `null`. */
function numberOf(value: unknown): number | null {
  if (typeof value === 'number') return value
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value.replace(/,/g, ''))
    return Number.isFinite(n) ? n : null
  }
  return null
}

/** Whether a cell meets a condition, given what it comes to and how it shows. */
export function meetsCondition(
  condition: SheetFilterCondition,
  value: unknown,
  text: string,
  collator = textCollator(),
) {
  const { op } = condition
  if (op === 'blank') return isEmptyValue(value)
  if (op === 'notBlank') return !isEmptyValue(value)
  const target = condition.value ?? ''
  const shown = text.toLocaleLowerCase()
  const wanted = String(target).toLocaleLowerCase()
  switch (op) {
    case 'contains':
      return shown.includes(wanted)
    case 'notContains':
      return !shown.includes(wanted)
    case 'begins':
      return shown.startsWith(wanted)
    case 'ends':
      return shown.endsWith(wanted)
  }
  // comparisons: as numbers when both are, else as text
  const a = typeof value === 'number' ? value : null
  const b = numberOf(target)
  let c: number
  if (a != null && b != null) c = a - b
  else if (isEmptyValue(value))
    return op === 'ne' ? !isEmptyValue(target) : op === 'eq' && isEmptyValue(target)
  else c = collator.compare(text, String(target))
  switch (op) {
    case 'eq':
      return c === 0
    case 'ne':
      return c !== 0
    case 'gt':
      return c > 0
    case 'ge':
      return c >= 0
    case 'lt':
      return c < 0
    case 'le':
      return c <= 0
  }
  return true
}

/** Whether a cell is kept by a column's filter rule. */
export function meetsRule(
  rule: SheetFilterRule,
  value: unknown,
  text: string,
  collator = textCollator(),
) {
  if ('values' in rule) return rule.values.includes(isEmptyValue(value) ? '' : text)
  return meetsCondition(rule.condition, value, text, collator)
}
