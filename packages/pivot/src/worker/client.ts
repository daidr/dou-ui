import { PivotResult } from '../engine/compute'
import { neededColumns, type PivotComputeRequest, type PivotEngine } from '../engine/engine'
import type { PivotSource } from '../engine/source'
import type { PivotConfig } from '../engine/types'
import type { PivotFromWorker, PivotToWorker, PivotWorkerField } from './protocol'

/** The page's side of the messages: a `Worker`, or anything that talks like one. */
export interface PivotWorkerLike {
  postMessage(message: unknown, transfer?: Transferable[]): void
  addEventListener(type: 'message', listener: (event: MessageEvent) => void): void
  terminate?(): void
}

/** How long the page reads records before it lets other work run, in ms. */
const SLICE = 6

const abortError = () => new DOMException('A newer config came in', 'AbortError')

/** Lets the page paint and handle input between slices of reading. */
const breathe = (() => {
  if (typeof MessageChannel === 'undefined') return () => new Promise((r) => setTimeout(r))
  const channel = new MessageChannel()
  const waiting: (() => void)[] = []
  channel.port1.addEventListener('message', () => waiting.shift()?.())
  channel.port1.start()
  return () =>
    new Promise<void>((resolve) => {
      waiting.push(resolve)
      channel.port2.postMessage(0)
    })
})()

/** Runs reading in slices of a few ms each, so the page stays responsive. */
async function sliced<T>(steps: Generator<void, T>, signal?: AbortSignal): Promise<T> {
  let until = performance.now() + SLICE
  for (;;) {
    const step = steps.next()
    if (step.done) return step.value
    if (performance.now() < until) continue
    await breathe()
    if (signal?.aborted) throw abortError()
    until = performance.now() + SLICE
  }
}

const describe = <Row>(source: PivotSource<Row>): PivotWorkerField[] =>
  [...source.fields.values()].map((f) => ({
    name: f.name,
    label: f.label,
    type: f.type,
    ...(f.order ? { order: f.order } : {}),
  }))

/**
 * An engine that sums up in a worker, so a million records never hold up
 * the page. The page reads each field the config needs once, in slices of
 * a few milliseconds, and moves it to the worker (no copy); after that
 * only configs go over.
 *
 * Pass a worker that calls `servePivot`, or a function that makes one
 * (made when first needed).
 */
export function createPivotWorker(worker: PivotWorkerLike | (() => PivotWorkerLike)): PivotEngine {
  let w: PivotWorkerLike | null = null
  let current: object | null = null
  let sourceId = 0
  let nextId = 0
  const known = new Set<string>()
  const sent = { dimensions: new Set<string>(), measures: new Set<string>() }
  const waiting = new Map<
    number,
    {
      resolve: (message: PivotFromWorker) => void
    }
  >()

  // one compute reads fields at a time, so two never read the same field
  let lane: Promise<unknown> = Promise.resolve()

  const post = (message: PivotToWorker, transfer?: Transferable[]) =>
    w!.postMessage(message, transfer)

  const connect = () => {
    if (w) return w
    w = typeof worker === 'function' ? worker() : worker
    w.addEventListener('message', (event) => {
      const m = event.data as PivotFromWorker
      const job = waiting.get(m.id)
      if (!job) return
      waiting.delete(m.id)
      job.resolve(m)
    })
    return w
  }

  /** Reads and sends the fields the worker does not have yet. */
  async function ship<Row>(
    source: PivotSource<Row>,
    need: { dimensions: string[]; measures: string[] },
    signal?: AbortSignal,
  ) {
    const fresh = describe(source).filter((f) => !known.has(f.name))
    if (fresh.length) {
      for (const f of fresh) known.add(f.name)
      post({ type: 'fields', source: sourceId, fields: fresh })
    }
    for (const name of need.dimensions) {
      if (sent.dimensions.has(name)) continue
      const id = sourceId
      const column = await sliced(source.encodeSteps(name), signal)
      if (id !== sourceId) throw abortError()
      post({ type: 'dimension', source: id, name, ...column }, [column.codes.buffer])
      sent.dimensions.add(name)
    }
    for (const name of need.measures) {
      if (sent.measures.has(name)) continue
      const id = sourceId
      const values = await sliced(source.measureSteps(name, true), signal)
      if (id !== sourceId) throw abortError()
      post({ type: 'measure', source: id, name, values }, [values.buffer])
      sent.measures.add(name)
    }
  }

  return {
    async compute(source, config: PivotConfig, request: PivotComputeRequest = {}) {
      const { signal } = request
      connect()
      if (source !== current) {
        current = source
        sourceId++
        known.clear()
        sent.dimensions.clear()
        sent.measures.clear()
        const fields = describe(source)
        for (const f of fields) known.add(f.name)
        post({
          type: 'source',
          source: sourceId,
          length: source.length,
          locale: source.locale,
          fields,
        })
      }
      const typeOf = (name: string) => source.field(name).type
      const need = neededColumns(typeOf, config, request.aggregators)
      const shipped = lane.then(() => ship(source, need, signal))
      lane = shipped.catch(() => {})
      await shipped
      // the worker may need more than the page could tell (a custom aggregator's input)
      for (let round = 0; round < 3; round++) {
        if (signal?.aborted) throw abortError()
        const id = nextId++
        const answer = await new Promise<PivotFromWorker>((resolve) => {
          waiting.set(id, { resolve })
          post({ type: 'compute', source: sourceId, id, config })
        })
        if (answer.type === 'result') return PivotResult.unpack(answer.packet, source, config)
        if (answer.type === 'error') throw new Error(answer.message)
        if (answer.type === 'skipped') throw abortError()
        await ship(source, answer, signal)
      }
      throw new Error('[DouPivot] worker 一直缺少字段')
    },
    dispose() {
      w?.terminate?.()
      w = null
      current = null
      for (const job of waiting.values()) job.resolve({ type: 'skipped', id: -1 })
      waiting.clear()
    },
  }
}
