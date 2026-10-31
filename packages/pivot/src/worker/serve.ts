import type { PivotAggregator } from '../engine/aggregate'
import { computePivot, PivotResult } from '../engine/compute'
import { neededColumns } from '../engine/engine'
import { PivotSource } from '../engine/source'
import type { PivotFromWorker, PivotToWorker } from './protocol'

export interface ServePivotOptions {
  /** Custom aggregators (`defineAggregator`) the configs may name; functions cannot be sent, so they live here. */
  aggregators?: readonly PivotAggregator[]
}

/** The worker's side of the messages: anything with `postMessage` and `onmessage`. */
export interface PivotWorkerScope {
  postMessage(message: unknown, transfer?: Transferable[]): void
  addEventListener(type: 'message', listener: (event: MessageEvent) => void): void
}

/**
 * Sums up for the page in a worker. Call it in your own worker file when
 * configs use custom aggregators; `DouPivot`'s built-in worker calls it
 * with none.
 *
 * ```ts
 * // pivot.worker.ts
 * import { servePivot } from '@dou-ui/pivot/worker'
 * servePivot({ aggregators: [weightedAverage] })
 * ```
 */
export function servePivot(
  options: ServePivotOptions = {},
  scope: PivotWorkerScope = globalThis as unknown as PivotWorkerScope,
) {
  const aggregators: Record<string, PivotAggregator> = {}
  for (const a of options.aggregators ?? []) aggregators[a.name] = a
  let source: PivotSource<unknown> | null = null
  let sourceId = -1
  const have = { dimensions: new Set<string>(), measures: new Set<string>() }
  // only the newest compute is worth doing: the ones that queued up behind it are skipped
  let pending: Extract<PivotToWorker, { type: 'compute' }> | null = null
  let scheduled = false
  const send = (message: PivotFromWorker, transfer?: Transferable[]) =>
    scope.postMessage(message, transfer)

  const run = () => {
    scheduled = false
    const job = pending
    pending = null
    if (!job || !source || job.source !== sourceId) return
    const s = source
    const need = neededColumns((name) => s.field(name).type, job.config, aggregators)
    const dimensions = need.dimensions.filter((n) => !have.dimensions.has(n))
    const measures = need.measures.filter((n) => !have.measures.has(n))
    if (dimensions.length || measures.length) {
      send({ type: 'need', id: job.id, dimensions, measures })
      return
    }
    try {
      const packet = computePivot(s, job.config, { aggregators }).pack()
      send({ type: 'result', id: job.id, packet }, PivotResult.transferables(packet))
    } catch (error) {
      send({ type: 'error', id: job.id, message: (error as Error).message })
    }
  }

  scope.addEventListener('message', (event) => {
    const m = event.data as PivotToWorker
    if (m.type === 'source') {
      sourceId = m.source
      source = new PivotSource({}, { fields: m.fields, locale: m.locale, length: m.length })
      have.dimensions.clear()
      have.measures.clear()
      return
    }
    if (m.source !== sourceId || !source) return
    if (m.type === 'fields') {
      for (const f of m.fields) source.define(f)
    } else if (m.type === 'dimension') {
      source.provide(m.name, { codes: m.codes, labels: m.labels, empty: m.empty })
      have.dimensions.add(m.name)
    } else if (m.type === 'measure') {
      source.provideMeasure(m.name, m.values)
      have.measures.add(m.name)
    } else {
      if (pending) send({ type: 'skipped', id: pending.id })
      pending = m
      if (!scheduled) {
        scheduled = true
        setTimeout(run)
      }
    }
  })
}
