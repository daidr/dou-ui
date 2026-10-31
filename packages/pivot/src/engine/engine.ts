import { BUILTIN_AGGREGATORS, type PivotAggregator } from './aggregate'
import type { PivotResult } from './compute'
import type { PivotFieldType, PivotConfig } from './types'
import type { PivotSource } from './source'

export interface PivotComputeRequest {
  /** Aggregators by name, beside the built-in ones. */
  aggregators?: Readonly<Record<string, PivotAggregator>>
  /** Aborted when a newer config makes this one stale. */
  signal?: AbortSignal
}

/**
 * Sums up the records somewhere else than in the page: in a worker
 * (`createPivotWorker`), or on a server. `DouPivot` asks it for a result
 * whenever the fields to sum up change, and shows only the newest one.
 */
export interface PivotEngine {
  compute<Row>(
    source: PivotSource<Row>,
    config: PivotConfig,
    request?: PivotComputeRequest,
  ): Promise<PivotResult>
  /** Lets go of what it holds (a worker, a connection) when the table goes away. */
  dispose?(): void
}

/**
 * The fields a config reads, and how: grouped (`dimensions`: on an axis,
 * filtered, counted) or as numbers (`measures`: summed and the like).
 */
export function neededColumns(
  typeOf: (name: string) => PivotFieldType,
  config: PivotConfig,
  aggregators: Readonly<Record<string, PivotAggregator>> = {},
) {
  const dimensions = new Set<string>()
  const measures = new Set<string>()
  for (const d of [...(config.rows ?? []), ...(config.columns ?? [])])
    dimensions.add(typeof d === 'string' ? d : d.field)
  for (const name of Object.keys(config.filters ?? {})) {
    const f = config.filters![name]!
    if (f.include || f.exclude) dimensions.add(name)
  }
  for (const v of config.values ?? []) {
    const spec = typeof v === 'string' ? { field: v } : v
    if (spec.field === undefined) continue
    const name = spec.aggregate ?? (typeOf(spec.field) === 'number' ? 'sum' : 'count')
    const input =
      name === 'count'
        ? 'value'
        : (aggregators[name]?.input ?? BUILTIN_AGGREGATORS[name]?.input ?? 'number')
    if (input === 'value') dimensions.add(spec.field)
    else measures.add(spec.field)
  }
  return { dimensions: [...dimensions], measures: [...measures] }
}
