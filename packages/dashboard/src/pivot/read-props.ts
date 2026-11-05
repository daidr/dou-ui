import type { PivotConfig, PivotDimension, PivotValue } from '@dou-ui/pivot'
import { flagOf, oneOf, recordOf, textOf } from '../widgets/shared'
import type { PivotWidgetProps } from './types'

/** A field on the rows or columns: its name, or an object with a text `field`. */
const isDimension = (item: unknown): item is PivotDimension =>
  typeof item === 'string' || typeof recordOf(item)?.field === 'string'

/** A value: a field's name, or an object. */
const isValue = (item: unknown): item is PivotValue =>
  typeof item === 'string' || recordOf(item) !== undefined

const listOf = <T>(value: unknown, keep: (item: unknown) => item is T): T[] | undefined =>
  Array.isArray(value) ? value.filter(keep) : undefined

/**
 * The pivot's config with the right shape at its top: lists where lists go,
 * objects where objects go; what isn't counts as not set. Deeper mistakes,
 * like a filter's `include` that isn't a list, are left to the widget's
 * error state.
 */
function configOf(value: unknown): PivotConfig | undefined {
  const config = recordOf(value)
  if (!config) return undefined
  const filters = recordOf(config.filters)
  const sort = recordOf(config.sort)
  const totals = recordOf(config.totals)
  return {
    rows: listOf(config.rows, isDimension),
    columns: listOf(config.columns, isDimension),
    values: listOf(config.values, isValue),
    filters: filters
      ? (Object.fromEntries(
          Object.entries(filters).filter(([, filter]) => recordOf(filter)),
        ) as PivotConfig['filters'])
      : undefined,
    valuesOn: oneOf(config.valuesOn, ['columns', 'rows'] as const),
    sort:
      sort && typeof sort.valueIndex === 'number' && oneOf(sort.order, ['asc', 'desc'] as const)
        ? (sort as unknown as PivotConfig['sort'])
        : undefined,
    totals: totals
      ? {
          ...(typeof totals.rows === 'boolean' ? { rows: totals.rows } : {}),
          ...(typeof totals.columns === 'boolean' ? { columns: totals.columns } : {}),
        }
      : undefined,
  }
}

/** The pivot widget's props as its type says; what isn't the right type counts as not set. */
export function pivotPropsOf(props: Record<string, unknown>): PivotWidgetProps {
  return {
    source: textOf(props.source),
    path: textOf(props.path),
    config: configOf(props.config),
    filter: flagOf(props.filter),
  }
}
