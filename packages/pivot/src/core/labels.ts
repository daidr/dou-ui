import type { PivotResolvedValue } from '../engine'
import { format } from '../locale'

interface ValueTexts {
  value: string
  aggregates: Record<string, string>
}

/**
 * A value's header: its `label`, the field's name for a sum, or the field
 * and the way it is summed up ("销售额 · 平均值"); a plain count is "计数".
 */
export function valueLabel(value: PivotResolvedValue, label: string | undefined, m: ValueTexts) {
  if (label ?? value.label) return (label ?? value.label)!
  if (value.implicit || !value.field) return m.aggregates.count!
  if (value.aggregate === 'sum') return value.field.label
  return format(m.value, {
    field: value.field.label,
    aggregate: m.aggregates[value.aggregate] ?? value.aggregator?.label ?? value.aggregate,
  })
}
