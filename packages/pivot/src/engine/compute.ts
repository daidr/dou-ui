import {
  BUILTIN_AGGREGATORS,
  distinctAggregator,
  FAST_AGGREGATES,
  type PivotAggregator,
} from './aggregate'
import { IntIndex, typed, type PivotIndexPacket } from './hash'
import type { PivotResolvedField, PivotSource } from './source'
import { PivotTree, PivotTreeBuilder, type PivotLevel, type PivotTreePacket } from './tree'
import type { PivotConfig, PivotDimension, PivotFormat, PivotValueSort } from './types'

/** A value of the config with everything filled in. */
export interface PivotResolvedValue {
  field: PivotResolvedField<unknown> | null
  aggregate: string
  /** The custom aggregator, for names that are not built in. */
  aggregator?: PivotAggregator
  /** As given; the component works out a header when there is none. */
  label?: string
  format?: PivotFormat
  /** Whether the value is a count, written without decimals. */
  integer: boolean
  /** Whether it stands in for an empty `values` (a count of records). */
  implicit?: boolean
}

export interface PivotComputeOptions {
  /** Aggregators by name, beside the built-in ones. */
  aggregators?: Readonly<Record<string, PivotAggregator>>
}

/** The fields of the config resolved against a source, without reading any records. */
export function resolveConfig(
  source: PivotSource<unknown>,
  config: PivotConfig,
  options: PivotComputeOptions = {},
) {
  const level = (item: PivotDimension) => {
    const spec = typeof item === 'string' ? { field: item } : item
    return {
      field: source.field(spec.field),
      sort: spec.sort ?? 'asc',
      subtotal: spec.subtotal ?? true,
      by: spec.by,
    }
  }
  const values: PivotResolvedValue[] = (config.values ?? []).map((item) => {
    const spec = typeof item === 'string' ? { field: item } : item
    const field = spec.field === undefined ? null : source.field(spec.field)
    let name = spec.aggregate ?? (field?.type === 'number' ? 'sum' : 'count')
    if (!field && name !== 'count') name = 'count'
    const aggregator = FAST_AGGREGATES.has(name)
      ? undefined
      : (options.aggregators?.[name] ?? BUILTIN_AGGREGATORS[name])
    if (!FAST_AGGREGATES.has(name) && !aggregator) {
      throw new Error(`[DouPivot] 没有名为 "${name}" 的汇总方式`)
    }
    return {
      field,
      aggregate: name,
      aggregator,
      label: spec.label,
      format: spec.format ?? field?.format,
      integer: name === 'count' || !!aggregator?.integer,
    }
  })
  if (values.length === 0)
    values.push({ field: null, aggregate: 'count', integer: true, implicit: true })
  return {
    rows: (config.rows ?? []).map(level),
    columns: (config.columns ?? []).map(level),
    values,
  }
}

/**
 * Groups the records by the config's row and column fields and sums up
 * its values for every group, subtotal and total.
 *
 * Each record is placed once, in its innermost row group and innermost
 * column group; the values are summed per such pair, and every subtotal
 * is then merged from those pairs, never from the records again.
 */
export function computePivot<Row>(
  source: PivotSource<Row>,
  config: PivotConfig,
  options: PivotComputeOptions = {},
): PivotResult {
  const src = source as PivotSource<unknown>
  const resolved = resolveConfig(src, config, options)
  const rowLevels: PivotLevel[] = resolved.rows.map((l) => ({
    ...l,
    column: src.dimension(l.field.name, l.by),
  }))
  const colLevels: PivotLevel[] = resolved.columns.map((l) => ({
    ...l,
    column: src.dimension(l.field.name, l.by),
  }))
  const n = source.length
  const rowTree = new PivotTreeBuilder(stride(rowLevels))
  const colTree = new PivotTreeBuilder(stride(colLevels))
  const rowCodes = rowLevels.map((l) => l.column.codes)
  const colCodes = colLevels.map((l) => l.column.codes)
  // more than any column node can be, so (row, column) makes a unique key
  const width = n * Math.max(1, colLevels.length) + 2

  const filters = Object.entries(config.filters ?? {}).flatMap(([name, filter]) => {
    if (!filter.include && !filter.exclude) return []
    // without its own grouping, a filter takes the one the field has on an axis
    const by =
      filter.by ?? [...resolved.rows, ...resolved.columns].find((l) => l.field.name === name)?.by
    const column = src.dimension(name, by)
    const allow = new Uint8Array(column.labels.length).fill(filter.include ? 0 : 1)
    for (const value of filter.include ?? []) {
      const code = column.find(value)
      if (code >= 0) allow[code] = 1
    }
    for (const value of filter.exclude ?? []) {
      const code = column.find(value)
      if (code >= 0) allow[code] = 0
    }
    return [{ codes: column.codes, allow }]
  })

  const slotOf = new Int32Array(n)
  const cells = new IntIndex(1024)
  let matched = 0
  const rowCards = rowLevels.map((l) => l.column.labels.length)
  const colCards = colLevels.map((l) => l.column.labels.length)
  const rowSpace = rowCards.reduce((a, b) => a * b, 1)
  const colSpace = colCards.reduce((a, b) => a * b, 1)
  const skip = (i: number) => {
    for (let f = 0; f < filters.length; f++) {
      const filter = filters[f]!
      if (filter.allow[filter.codes[i]!] === 0) return true
    }
    return false
  }

  if (rowSpace * colSpace <= Number.MAX_SAFE_INTEGER) {
    // Each record's innermost groups, written as one number per axis (the group
    // numbers as digits). A pair of them is looked up once per record, in a
    // plain array when every pair fits in one; the trees are grown once per pair.
    const space = rowSpace * colSpace
    const dense = space <= DENSE_PAIRS ? new Int32Array(space).fill(-1) : null
    const index = dense ? null : new IntIndex(1024)
    let pairRow = new Float64Array(1024)
    let pairCol = new Float64Array(1024)
    let pairs = 0
    for (let i = 0; i < n; i++) {
      if (filters.length && skip(i)) {
        slotOf[i] = -1
        continue
      }
      let rk = 0
      for (let d = 0; d < rowCodes.length; d++) rk = rk * rowCards[d]! + rowCodes[d]![i]!
      let ck = 0
      for (let d = 0; d < colCodes.length; d++) ck = ck * colCards[d]! + colCodes[d]![i]!
      const key = rk * colSpace + ck
      let slot: number
      if (dense) {
        slot = dense[key]!
        if (slot < 0) slot = dense[key] = pairs
      } else slot = index!.add(key)
      if (slot === pairs) {
        if (pairs === pairRow.length) {
          const grownRow = new Float64Array(pairs * 2)
          grownRow.set(pairRow)
          pairRow = grownRow
          const grownCol = new Float64Array(pairs * 2)
          grownCol.set(pairCol)
          pairCol = grownCol
        }
        pairRow[pairs] = rk
        pairCol[pairs] = ck
        pairs++
      }
      slotOf[i] = slot
      matched++
    }
    const rowLeaf = new Map<number, number>()
    const colLeaf = new Map<number, number>()
    const rowDigits = new Int32Array(rowCards.length)
    const colDigits = new Int32Array(colCards.length)
    for (let p = 0; p < pairs; p++) {
      const row = leaf(pairRow[p]!, rowLeaf, rowTree, rowCards, rowDigits)
      const col = leaf(pairCol[p]!, colLeaf, colTree, colCards, colDigits)
      // pairs are distinct, so the cell made here is cell number p
      cells.add(row * width + col)
    }
  } else {
    // too many combinations to number: walk down the trees record by record
    for (let i = 0; i < n; i++) {
      if (filters.length && skip(i)) {
        slotOf[i] = -1
        continue
      }
      let row = 0
      for (let d = 0; d < rowCodes.length; d++) row = rowTree.child(row, rowCodes[d]![i]!)
      let col = 0
      for (let d = 0; d < colCodes.length; d++) col = colTree.child(col, colCodes[d]![i]!)
      slotOf[i] = cells.add(row * width + col)
      matched++
    }
  }

  // every (ancestor row, ancestor column) pair that each innermost pair adds into
  const leaves = cells.size
  const rowDepth = rowLevels.length
  const colDepth = colLevels.length
  const fan = (rowDepth + 1) * (colDepth + 1) - 1
  const targets = new Int32Array(leaves * fan)
  const rowUp = new Int32Array(rowDepth + 1)
  const colUp = new Int32Array(colDepth + 1)
  const leafRow = new Int32Array(leaves)
  const leafCol = new Int32Array(leaves)
  for (let s = 0; s < leaves; s++) {
    const key = cells.keys[s]!
    const row = Math.floor(key / width)
    const col = key - row * width
    leafRow[s] = row
    leafCol[s] = col
    for (let d = 0, at = row; d <= rowDepth; d++, at = rowTree.parent[at]!) rowUp[d] = at
    for (let d = 0, at = col; d <= colDepth; d++, at = colTree.parent[at]!) colUp[d] = at
    let k = s * fan
    for (let a = 0; a <= rowDepth; a++) {
      for (let b = 0; b <= colDepth; b++) {
        if (a === 0 && b === 0) continue
        targets[k++] = cells.add(rowUp[a]! * width + colUp[b]!)
      }
    }
  }

  const size = cells.size
  const data = resolved.values.map((value) =>
    aggregate(src, value, slotOf, leaves, size, targets, fan),
  )
  return new PivotResult({
    rows: new PivotTree(rowTree, rowLevels),
    columns: new PivotTree(colTree, colLevels),
    values: resolved.values,
    matched,
    cells,
    width,
    data,
    slotOf,
    leafRow,
    leafCol,
  })
}

/** More than any group number of the axis, so (parent, group) makes a unique key. */
const stride = (levels: PivotLevel[]) =>
  Math.max(1, ...levels.map((l) => l.column.labels.length)) + 1

/** The innermost group whose group numbers are the digits of `key`, made when new. */
function leaf(
  key: number,
  memo: Map<number, number>,
  tree: PivotTreeBuilder,
  cards: number[],
  digits: Int32Array,
) {
  let node = memo.get(key)
  if (node !== undefined) return node
  for (let d = cards.length - 1, rest = key; d >= 0; d--) {
    const card = cards[d]!
    const digit = rest % card
    digits[d] = digit
    rest = (rest - digit) / card
  }
  node = 0
  for (let d = 0; d < cards.length; d++) node = tree.child(node, digits[d]!)
  memo.set(key, node)
  return node
}

/** Pairs of innermost groups up to this many are found in a plain array instead of a hash. */
const DENSE_PAIRS = 1 << 22

/** One value for every cell: summed per innermost pair, then merged up into the totals. */
function aggregate(
  source: PivotSource<unknown>,
  value: PivotResolvedValue,
  slotOf: Int32Array,
  leaves: number,
  size: number,
  targets: Int32Array,
  fan: number,
) {
  const n = slotOf.length
  const out = new Float64Array(size)
  const kind = value.aggregate
  const roll = (fn: (into: number, from: number) => void) => {
    for (let s = 0; s < leaves; s++) {
      const base = s * fan
      for (let k = 0; k < fan; k++) fn(targets[base + k]!, s)
    }
  }

  if (kind === 'count') {
    if (value.field) {
      const { codes, empty } = source.dimension(value.field.name)
      for (let i = 0; i < n; i++) {
        const s = slotOf[i]!
        if (s >= 0 && codes[i] !== empty) out[s]!++
      }
    } else {
      for (let i = 0; i < n; i++) {
        const s = slotOf[i]!
        if (s >= 0) out[s]!++
      }
    }
    roll((t, s) => (out[t]! += out[s]!))
    return out
  }

  if (FAST_AGGREGATES.has(kind)) {
    const values = source.measure(value.field!.name)
    if (kind === 'min' || kind === 'max') {
      out.fill(Number.NaN)
      const max = kind === 'max'
      for (let i = 0; i < n; i++) {
        const s = slotOf[i]!
        const v = values[i]!
        if (s < 0 || v !== v) continue
        const at = out[s]!
        // NaN compares false, so an empty cell takes the first value
        if (max ? !(at >= v) : !(at <= v)) out[s] = v
      }
      roll((t, s) => {
        const v = out[s]!
        if (v !== v) return
        const at = out[t]!
        if (max ? !(at >= v) : !(at <= v)) out[t] = v
      })
      return out
    }
    // sum and avg: a total and how many records went into it
    const count = new Float64Array(size)
    for (let i = 0; i < n; i++) {
      const s = slotOf[i]!
      const v = values[i]!
      if (s < 0 || v !== v) continue
      out[s]! += v
      count[s]!++
    }
    roll((t, s) => {
      out[t]! += out[s]!
      count[t]! += count[s]!
    })
    for (let s = 0; s < size; s++) {
      const c = count[s]!
      out[s] = c === 0 ? Number.NaN : kind === 'avg' ? out[s]! / c : out[s]!
    }
    return out
  }

  const aggregator = value.aggregator!
  const field = value.field!
  const states: unknown[] = Array.from({ length: size })
  const { init, merge } = aggregator
  const add = aggregator.add as (state: unknown, value: unknown) => unknown
  if (aggregator.input === 'number') {
    const values = source.measure(field.name)
    for (let i = 0; i < n; i++) {
      const s = slotOf[i]!
      const v = values[i]!
      if (s < 0 || v !== v) continue
      states[s] = add(states[s] ?? init(), v)
    }
  } else {
    const { codes, labels, empty } = source.dimension(field.name)
    const byCode = aggregator === distinctAggregator
    for (let i = 0; i < n; i++) {
      const s = slotOf[i]!
      const code = codes[i]!
      if (s < 0 || code === empty) continue
      states[s] = add(states[s] ?? init(), byCode ? code : labels[code])
    }
  }
  roll((t, s) => {
    const from = states[s]
    if (from !== undefined) states[t] = merge(states[t] ?? init(), from)
  })
  const { result } = aggregator
  for (let s = 0; s < size; s++) {
    const state = states[s]
    out[s] = state === undefined ? Number.NaN : (result(state) ?? Number.NaN)
  }
  return out
}

interface PivotResultInit {
  rows: PivotTree
  columns: PivotTree
  values: PivotResolvedValue[]
  matched: number
  cells: IntIndex
  width: number
  data: Float64Array[]
  slotOf: Int32Array
  leafRow: Int32Array
  leafCol: Int32Array
}

/**
 * A `PivotResult` as data: typed arrays a worker moves to the page without
 * copying, or plain arrays from JSON (a result summed up on a server).
 */
export interface PivotPacket {
  rows: PivotTreePacket
  columns: PivotTreePacket
  values: {
    field: string | null
    aggregate: string
    integer: boolean
    implicit?: boolean
    label?: string
  }[]
  matched: number
  cells: PivotIndexPacket
  width: number
  data: ArrayLike<number>[]
  slotOf: ArrayLike<number>
  leafRow: ArrayLike<number>
  leafCol: ArrayLike<number>
}

const plainArray = (a: ArrayLike<number>) => Array.from(a)

/** A packet with plain arrays in place of typed ones, ready for JSON. */
function toPlain(packet: PivotPacket): PivotPacket {
  const tree = (t: PivotTreePacket): PivotTreePacket => ({
    ...t,
    parent: plainArray(t.parent),
    depth: plainArray(t.depth),
    code: plainArray(t.code),
    childStart: plainArray(t.childStart),
    children: plainArray(t.children),
    enter: plainArray(t.enter),
    exit: plainArray(t.exit),
    index: index(t.index),
    levels: t.levels.map((l) => ({ ...l, rank: plainArray(l.rank) })),
  })
  const index = (i: PivotIndexPacket): PivotIndexPacket => ({
    size: i.size,
    table: plainArray(i.table),
    ids: plainArray(i.ids),
    keys: plainArray(i.keys).slice(0, i.size),
  })
  return {
    ...packet,
    rows: tree(packet.rows),
    columns: tree(packet.columns),
    cells: index(packet.cells),
    data: packet.data.map((d) => Array.from(d, (v) => (v === v ? v : (null as never)))),
    slotOf: plainArray(packet.slotOf),
    leafRow: plainArray(packet.leafRow),
    leafCol: plainArray(packet.leafCol),
  }
}

/** The groups on both axes and every cell's values. */
export class PivotResult {
  readonly rows: PivotTree
  readonly columns: PivotTree
  readonly values: readonly PivotResolvedValue[]
  /** How many records passed the filters. */
  readonly matched: number
  private cells: IntIndex
  private width: number
  private data: Float64Array[]
  /** Each record's innermost cell, -1 when filtered out; and each such cell's groups. */
  private slotOf: Int32Array
  private leafRow: Int32Array
  private leafCol: Int32Array

  constructor(init: PivotResultInit) {
    this.rows = init.rows
    this.columns = init.columns
    this.values = init.values
    this.matched = init.matched
    this.cells = init.cells
    this.width = init.width
    this.data = init.data
    this.slotOf = init.slotOf
    this.leafRow = init.leafRow
    this.leafCol = init.leafCol
  }

  /**
   * The result as data, to send from a worker or a server. With `plain`,
   * plain arrays for `JSON.stringify` (typed arrays do not survive it);
   * empty cells go as `null`.
   */
  pack({ plain = false }: { plain?: boolean } = {}): PivotPacket {
    const packet = this.packTyped()
    return plain ? toPlain(packet) : packet
  }

  private packTyped(): PivotPacket {
    return {
      rows: this.rows.pack(),
      columns: this.columns.pack(),
      values: this.values.map((v) => ({
        field: v.field?.name ?? null,
        aggregate: v.aggregate,
        integer: v.integer,
        ...(v.implicit ? { implicit: true } : {}),
        ...(v.label === undefined ? {} : { label: v.label }),
      })),
      matched: this.matched,
      cells: this.cells.pack(),
      width: this.width,
      data: this.data,
      slotOf: this.slotOf,
      leafRow: this.leafRow,
      leafCol: this.leafCol,
    }
  }

  /** The typed arrays in a packet, to move them instead of copying (`postMessage`'s transfer list). */
  static transferables(packet: PivotPacket): ArrayBuffer[] {
    const out = new Set<ArrayBuffer>()
    const add = (a: ArrayLike<number>) => {
      if (ArrayBuffer.isView(a) && a.buffer instanceof ArrayBuffer) out.add(a.buffer)
    }
    for (const tree of [packet.rows, packet.columns]) {
      for (const a of [tree.parent, tree.depth, tree.code, tree.childStart, tree.children]) add(a)
      for (const a of [tree.enter, tree.exit, tree.index.table, tree.index.ids, tree.index.keys])
        add(a)
      // a level's order belongs to the source, which keeps it for the next result
    }
    for (const a of [packet.cells.table, packet.cells.ids, packet.cells.keys]) add(a)
    for (const a of [...packet.data, packet.slotOf, packet.leafRow, packet.leafCol]) add(a)
    return [...out]
  }

  /**
   * A result made from `pack()`'s output. Fields are described by
   * `source` (no record is read), formats come from `config`.
   */
  static unpack<Row>(packet: PivotPacket, source: PivotSource<Row>, config?: PivotConfig) {
    const field = (name: string) => source.field(name) as PivotResolvedField<unknown>
    const given = config?.values ?? []
    return new PivotResult({
      rows: PivotTree.unpack(packet.rows, field),
      columns: PivotTree.unpack(packet.columns, field),
      values: packet.values.map((v, i) => {
        const f = v.field === null ? null : field(v.field)
        const spec = v.implicit ? undefined : given[i]
        const format = typeof spec === 'object' ? spec.format : undefined
        return { ...v, field: f, format: format ?? f?.format }
      }),
      matched: packet.matched,
      cells: IntIndex.unpack(packet.cells),
      width: packet.width,
      // JSON wrote NaN (an empty cell) as null
      data: packet.data.map((d) =>
        d instanceof Float64Array ? d : Float64Array.from(d, (v) => v ?? Number.NaN),
      ),
      slotOf: typed(Int32Array, packet.slotOf),
      leafRow: typed(Int32Array, packet.leafRow),
      leafCol: typed(Int32Array, packet.leafCol),
    })
  }

  /**
   * The value at `valueIndex` (its place in `values`) of a row group and a
   * column group; `NaN` when no record falls in both. The trees' `total`
   * is the grand total.
   */
  get(row: number, column: number, valueIndex = 0): number {
    const slot = this.cells.get(row * this.width + column)
    return slot < 0 ? Number.NaN : this.data[valueIndex]![slot]!
  }

  /** The indexes of the records in a row group and a column group, for showing the details. */
  indices(row: number, column: number): number[] {
    const { slotOf, leafRow, leafCol, rows, columns } = this
    // which innermost cells fall in the cell, then which records fall in those
    const inside = new Uint8Array(leafRow.length)
    for (let s = 0; s < leafRow.length; s++)
      inside[s] = rows.within(leafRow[s]!, row) && columns.within(leafCol[s]!, column) ? 1 : 0
    const out: number[] = []
    for (let i = 0; i < slotOf.length; i++) {
      const s = slotOf[i]!
      if (s >= 0 && inside[s]) out.push(i)
    }
    return out
  }

  /**
   * The children of every row group, reordered by a column's values (or as
   * they are when `sort` is empty). Nothing is summed up again.
   */
  rowOrder(sort: PivotValueSort | null | undefined): Int32Array {
    const { rows } = this
    if (!sort || !this.data[sort.valueIndex]) return rows.children
    const column = this.columns.find(sort.column ?? [])
    if (column < 0) return rows.children
    const children = rows.children.slice()
    const keys = new Float64Array(rows.size)
    for (let node = 0; node < rows.size; node++)
      keys[node] = this.get(node, column, sort.valueIndex)
    const sign = sort.order === 'desc' ? -1 : 1
    const place = new Int32Array(rows.size)
    rows.children.forEach((node, at) => (place[node] = at))
    for (let node = 0; node < rows.size; node++) {
      const from = rows.childStart[node]!
      const to = rows.childStart[node + 1]!
      if (to - from < 2) continue
      children.subarray(from, to).sort((a, b) => {
        const ka = keys[a]!
        const kb = keys[b]!
        // empty cells last, ties in label order
        if (ka !== ka || kb !== kb) return ka !== ka ? (kb !== kb ? place[a]! - place[b]! : 1) : -1
        return ka === kb ? place[a]! - place[b]! : sign * (ka - kb)
      })
    }
    return children
  }
}
