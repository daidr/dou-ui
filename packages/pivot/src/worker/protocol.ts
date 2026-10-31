import type { PivotPacket } from '../engine/compute'
import type { PivotEncodedColumn } from '../engine/source'
import type { PivotConfig, PivotFieldType } from '../engine/types'

/** A field as the worker knows it: no functions, they stay in the page. */
export interface PivotWorkerField {
  name: string
  label: string
  type: PivotFieldType
  order?: readonly unknown[]
}

/** What the page sends. `source` numbers the records; anything for an older one is dropped. */
export type PivotToWorker =
  | {
      type: 'source'
      source: number
      length: number
      locale?: string
      fields: PivotWorkerField[]
    }
  /** Fields the page came to know after `source` (keys the config names that no field described). */
  | { type: 'fields'; source: number; fields: PivotWorkerField[] }
  | ({ type: 'dimension'; source: number; name: string } & PivotEncodedColumn)
  | { type: 'measure'; source: number; name: string; values: Float64Array }
  | { type: 'compute'; source: number; id: number; config: PivotConfig }

/** What the worker answers to a `compute`. */
export type PivotFromWorker =
  | { type: 'result'; id: number; packet: PivotPacket }
  /** Fields it was not sent, which the page could not tell it needs (a custom aggregator's input). */
  | { type: 'need'; id: number; dimensions: string[]; measures: string[] }
  /** A newer compute came in first. */
  | { type: 'skipped'; id: number }
  | { type: 'error'; id: number; message: string }
