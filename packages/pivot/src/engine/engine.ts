import { BUILTIN_AGGREGATORS, type PivotAggregator } from './aggregate'
import { checkFormula, type PivotResult } from './compute'
import type { PivotConfig } from './types'
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
 * No record is read.
 */
export function neededColumns<Row>(
  source: PivotSource<Row>,
  config: PivotConfig,
  aggregators: Readonly<Record<string, PivotAggregator>> = {},
) {
  const src = source as PivotSource<unknown>
  const dimensions = new Set<string>()
  const measures = new Set<string>()
  for (const d of [...(config.rows ?? []), ...(config.columns ?? [])])
    dimensions.add(typeof d === 'string' ? d : d.field)
  for (const name of Object.keys(config.filters ?? {})) {
    const f = config.filters![name]!
    if (f.include || f.exclude || f.top || f.between) dimensions.add(name)
  }
  for (const v of config.values ?? []) {
    const spec = typeof v === 'string' ? { field: v } : v
    if (spec.formula !== undefined) {
      let formula
      try {
        formula = checkFormula(src, spec.formula)
      } catch {
        // computing it says what is wrong
        continue
      }
      for (const term of formula.terms) {
        if (term.field === null) continue
        if (term.aggregate === 'count') dimensions.add(term.field)
        else measures.add(term.field)
      }
      continue
    }
    if (spec.field === undefined) continue
    const name = spec.aggregate ?? (src.field(spec.field).type === 'number' ? 'sum' : 'count')
    const input =
      name === 'count'
        ? 'value'
        : (aggregators[name]?.input ?? BUILTIN_AGGREGATORS[name]?.input ?? 'number')
    if (input === 'value') dimensions.add(spec.field)
    else measures.add(spec.field)
  }
  return { dimensions: [...dimensions], measures: [...measures] }
}
