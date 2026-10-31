import type { PivotResolvedValue } from '../engine'
import { format } from '../locale'

interface ValueTexts {
  value: string
  aggregates: Record<string, string>
  shows: Record<string, string>
  shownValue: string
}

/**
 * A value's header: its `label`, the field's name for a sum, or the field
 * and the way it is summed up ("销售额 · 平均值"); a plain count is "计数";
 * a calculated value's formula. A value with a `show` adds it ("销售额 · 占总计").
 */
export function valueLabel(value: PivotResolvedValue, label: string | undefined, m: ValueTexts) {
  if (label ?? value.label) return (label ?? value.label)!
  const base = plainLabel(value, m)
  return value.show ? format(m.shownValue, { value: base, show: m.shows[value.show.as]! }) : base
}

/** The header of a value without its `show`. */
function plainLabel(value: PivotResolvedValue, m: ValueTexts) {
  if (value.formula !== undefined) return value.formula
  if (value.implicit || !value.field) return m.aggregates.count!
  if (value.aggregate === 'sum') return value.field.label
  return format(m.value, {
    field: value.field.label,
    aggregate: m.aggregates[value.aggregate] ?? value.aggregator?.label ?? value.aggregate,
  })
}
