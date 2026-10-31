import { bucketer, groupKey, type PivotGroupBy } from './group'
import type { PivotField, PivotFieldType } from './types'

/** A field's groups: each record's group number, and each group's value. */
export interface PivotDimensionColumn {
  /** Each record's group. */
  codes: Uint32Array
  /** Each group's value; `null` for the empty group. */
  labels: unknown[]
  /** The empty group's number, or -1 when every record has a value. */
  empty: number
  /** Each group's place in the field's natural order (its `order`, then sorted, empty last). */
  rank: Uint32Array
  /** The group of `value`, or -1 when no record has it. */
  find: (value: unknown) => number
}

/** A field with its type worked out. */
export interface PivotResolvedField<Row = unknown> extends PivotField<Row> {
  label: string
  type: PivotFieldType
}

export interface PivotSourceOptions<Row> {
  fields?: readonly PivotField<Row>[]
  /** For sorting group labels; the runtime's locale when left out. */
  locale?: string
}

/**
 * Records given column by column: each field's values in one array (or
 * typed array), all of the same length. A million records take far less
 * memory this way than as a million objects.
 */
export type PivotColumns = Readonly<Record<string, ArrayLike<unknown>>>

/** The records: an array of objects, or their columns. */
export type PivotData<Row = Record<string, unknown>> = readonly Row[] | PivotColumns

/** A field's groups before they are put in order: what a worker is sent. */
export interface PivotEncodedColumn {
  codes: Uint32Array
  labels: unknown[]
  empty: number
}

const SAMPLE = 100
/** Records read between looks at the clock while reading in slices. */
const STEP = 4096

export const isColumns = (data: unknown): data is PivotColumns =>
  !!data && typeof data === 'object' && !Array.isArray(data)

/**
 * The records, read field by field into typed arrays the first time each
 * field is used, and kept until the records change.
 */
export class PivotSource<Row = Record<string, unknown>> {
  /** The records as given: objects, or columns. */
  readonly data: PivotData<Row>
  readonly length: number
  readonly fields: Map<string, PivotResolvedField<Row>>
  readonly locale: string | undefined
  private collator: Intl.Collator
  private dimensions = new Map<string, PivotDimensionColumn>()
  private measures = new Map<string, Float64Array>()
  /** Groups read elsewhere (in the page, for a worker), waiting to be put in order. */
  private given = new Map<string, PivotEncodedColumn>()

  constructor(data: PivotData<Row>, options: PivotSourceOptions<Row> & { length?: number } = {}) {
    this.data = data
    this.length = isColumns(data)
      ? (options.length ?? Math.max(0, ...Object.values(data).map((c) => c.length)))
      : data.length
    this.locale = options.locale
    this.collator = new Intl.Collator(options.locale, { numeric: true })
    this.fields = new Map()
    for (const field of options.fields ?? inferFields(data)) {
      this.fields.set(field.name, this.resolve(field))
    }
  }

  /** The record at `index`: the object given, or one made from the columns. */
  record(index: number): Row {
    const { data } = this
    if (!isColumns(data)) return data[index]!
    const row: Record<string, unknown> = {}
    for (const name in data) row[name] = data[name]![index]
    return row as Row
  }

  /** How to read a field from record `i`. */
  private reader(field: PivotField<Row>): (i: number) => unknown {
    const { data } = this
    const read = field.value
    if (read) {
      if (!isColumns(data)) return (i) => read(data[i]!, i)
      return (i) => read(this.record(i), i)
    }
    if (isColumns(data)) {
      const column = data[field.name]
      return column ? (i) => column[i] : () => undefined
    }
    const name = field.name
    return (i) => (data[i] as Record<string, unknown> | undefined)?.[name]
  }

  /** Describes a field (or describes it again), as `fields` would have. */
  define(field: PivotField<Row>) {
    this.fields.set(field.name, this.resolve(field))
  }

  /** Hands over groups read elsewhere, such as in the page for a worker. */
  provide(name: string, column: PivotEncodedColumn) {
    this.given.set(name, column)
    for (const key of this.dimensions.keys())
      if (key === name || key.startsWith(`${name}\u0000`)) this.dimensions.delete(key)
  }

  /** Hands over a field's numbers read elsewhere. */
  provideMeasure(name: string, values: Float64Array) {
    this.measures.set(name, values)
  }

  /** The field called `name`; one is made up for keys the fields do not list. */
  field(name: string): PivotResolvedField<Row> {
    let field = this.fields.get(name)
    if (!field) {
      field = this.resolve({ name })
      this.fields.set(name, field)
    }
    return field
  }

  /** The field's values, one per record. */
  values(name: string): unknown[] {
    const read = this.reader(this.field(name))
    const out: unknown[] = Array.from({ length: this.length })
    for (let i = 0; i < this.length; i++) out[i] = read(i)
    return out
  }

  /**
   * The field grouped by value, or by `by`: dates by a period, numbers in
   * ranges. A grouping is worked out from the field's groups, not from the
   * records, so it costs one pass over the group numbers.
   */
  dimension(name: string, by?: PivotGroupBy): PivotDimensionColumn {
    const key = by === undefined ? name : `${name}\u0000${groupKey(by)}`
    let column = this.dimensions.get(key)
    if (!column) {
      column = by === undefined ? this.encode(name) : this.group(name, by)
      this.dimensions.set(key, column)
    }
    return column
  }

  private group(name: string, by: PivotGroupBy): PivotDimensionColumn {
    const base = this.dimension(name)
    const bucketOf = bucketer(by)
    const labels: unknown[] = []
    const byValue = new Map<unknown, number>()
    let empty = -1
    // each of the field's groups goes in one bucket
    const map = new Uint32Array(base.labels.length)
    base.labels.forEach((label, code) => {
      const bucket = code === base.empty ? null : bucketOf(label)
      let to: number | undefined
      if (bucket === null) {
        if (empty < 0) {
          empty = labels.length
          labels.push(null)
        }
        to = empty
      } else {
        to = byValue.get(bucket)
        if (to === undefined) {
          to = labels.length
          labels.push(bucket)
          byValue.set(bucket, to)
        }
      }
      map[code] = to
    })
    const from = base.codes
    const codes = new Uint32Array(from.length)
    for (let i = 0; i < from.length; i++) codes[i] = map[from[i]!]!
    const find = (value: unknown) => (isEmpty(value) ? empty : (byValue.get(value) ?? -1))
    // buckets sort by themselves; the field's `order` is for its own values
    return { codes, labels, empty, rank: this.rank(labels, { name }, find), find }
  }

  /** The field as numbers, `NaN` where a record has none. */
  measure(name: string): Float64Array {
    let column = this.measures.get(name)
    if (!column) {
      column = run(this.measureSteps(name))
      this.measures.set(name, column)
    }
    return column
  }

  /**
   * Reads a field's numbers a slice at a time, for reading a large field
   * without holding up the page. The array is new: the source keeps none.
   */
  *measureSteps(name: string, copy = false): Generator<void, Float64Array> {
    const field = this.field(name)
    const given = isColumns(this.data) && !field.value ? this.data[name] : undefined
    // a column of numbers is used as it is (or copied, to be sent away)
    if (given instanceof Float64Array && given.length === this.length)
      return copy ? given.slice() : given
    const read = this.reader(field)
    const column = new Float64Array(this.length)
    for (let i = 0; i < this.length; i++) {
      if (i % STEP === 0 && i) yield
      column[i] = toNumber(read(i))
    }
    return column
  }

  private resolve(field: PivotField<Row>): PivotResolvedField<Row> {
    return {
      ...field,
      label: field.label ?? field.name,
      type: field.type ?? this.guess(field),
    }
  }

  private guess(field: PivotField<Row>): PivotFieldType {
    const read = this.reader(field)
    let seen = 0
    let type: PivotFieldType | undefined
    for (let i = 0; i < this.length && seen < SAMPLE; i++) {
      const value = read(i)
      if (isEmpty(value)) continue
      seen++
      const kind = typeOf(value)
      if (type && type !== kind) return 'string'
      type = kind
    }
    return type ?? 'string'
  }

  private encode(name: string): PivotDimensionColumn {
    const field = this.field(name)
    const given = this.given.get(name)
    const { codes, labels, empty } = given ?? run(this.encodeSteps(name))
    const find = finder(labels, empty)
    return { codes, labels, empty, rank: this.rank(labels, field, find), find }
  }

  /**
   * Reads a field's groups a slice at a time, for reading a large field
   * without holding up the page: each record's group number and each
   * group's value, not yet in order.
   */
  *encodeSteps(name: string): Generator<void, PivotEncodedColumn> {
    const read = this.reader(this.field(name))
    const n = this.length
    const codes = new Uint32Array(n)
    const labels: unknown[] = []
    const byValue = new Map<unknown, number>()
    const byTime = new Map<number, number>()
    let empty = -1
    let last: unknown = undefined
    let lastCode = -1
    const codeOf = (value: unknown) => {
      if (isEmpty(value)) {
        if (empty < 0) {
          empty = labels.length
          labels.push(null)
        }
        return empty
      }
      if (value instanceof Date) {
        const time = value.getTime()
        let code = byTime.get(time)
        if (code === undefined) {
          code = labels.length
          labels.push(value)
          byTime.set(time, code)
        }
        return code
      }
      let code = byValue.get(value)
      if (code === undefined) {
        code = labels.length
        labels.push(value)
        byValue.set(value, code)
      }
      return code
    }
    for (let i = 0; i < n; i++) {
      if (i % STEP === 0 && i) yield
      const value = read(i)
      // sorted data repeats itself, so the last lookup is often the answer
      if (value === last && lastCode >= 0) {
        codes[i] = lastCode
        continue
      }
      lastCode = codeOf(value)
      last = value
      codes[i] = lastCode
    }
    return { codes, labels, empty }
  }

  /** Each group's place: the field's `order` first, then by value, the empty group last. */
  private rank(labels: unknown[], field: PivotField<Row>, find: (value: unknown) => number) {
    const order = new Int32Array(labels.length).fill(-1)
    field.order?.forEach((value, at) => {
      const code = find(value)
      if (code >= 0 && order[code] === -1) order[code] = at
    })
    const codes = Array.from(labels.keys())
    const { collator } = this
    codes.sort((a, b) => {
      const oa = order[a]!
      const ob = order[b]!
      if (oa >= 0 || ob >= 0) {
        if (oa < 0) return 1
        if (ob < 0) return -1
        return oa - ob
      }
      return compareValues(labels[a], labels[b], collator)
    })
    const rank = new Uint32Array(labels.length)
    codes.forEach((code, at) => (rank[code] = at))
    return rank
  }
}

/** Empty: `null`, `undefined`, `''`, `NaN` and invalid dates all go in the empty group. */
export const isEmpty = (value: unknown) =>
  value === null ||
  value === undefined ||
  value === '' ||
  (typeof value === 'number' && Number.isNaN(value)) ||
  (value instanceof Date && Number.isNaN(value.getTime()))

const typeOf = (value: unknown): PivotFieldType =>
  typeof value === 'number'
    ? 'number'
    : typeof value === 'boolean'
      ? 'boolean'
      : value instanceof Date
        ? 'date'
        : 'string'

const KIND: Record<PivotFieldType, number> = { number: 0, date: 1, string: 2, boolean: 3 }

/** Natural order: numbers and dates by size, text by the locale (digits as numbers), empty last. */
export function compareValues(a: unknown, b: unknown, collator: Intl.Collator) {
  const ea = isEmpty(a)
  const eb = isEmpty(b)
  if (ea || eb) return ea === eb ? 0 : ea ? 1 : -1
  const ka = KIND[typeOf(a)]
  const kb = KIND[typeOf(b)]
  if (ka !== kb) return ka - kb
  if (ka === 2) return collator.compare(a as string, b as string)
  return Number(a) - Number(b)
}

/** A value as a number: numbers, dates and numeric text; `NaN` for anything else. */
export function toNumber(value: unknown) {
  if (typeof value === 'number') return value
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'string') {
    const text = value.trim()
    return text === '' ? Number.NaN : Number(text)
  }
  return Number.NaN
}

/** Runs reading in slices to the end, at once. */
export function run<T>(steps: Generator<void, T>): T {
  for (;;) {
    const step = steps.next()
    if (step.done) return step.value
  }
}

/** Finds a group by its value; dates by their time. */
export function finder(labels: readonly unknown[], empty: number) {
  const byValue = new Map<unknown, number>()
  const byTime = new Map<number, number>()
  labels.forEach((label, code) => {
    if (code === empty) return
    if (label instanceof Date) byTime.set(label.getTime(), code)
    else byValue.set(label, code)
  })
  return (value: unknown) => {
    if (isEmpty(value)) return empty
    if (value instanceof Date) return byTime.get(value.getTime()) ?? -1
    return byValue.get(value) ?? -1
  }
}

/** The fields of records nobody described: every key of the first records, or every column. */
function inferFields<Row>(data: PivotData<Row>): PivotField<Row>[] {
  if (isColumns(data)) return Object.keys(data).map((name) => ({ name }))
  const rows = data
  const names = new Set<string>()
  for (let i = 0; i < Math.min(rows.length, SAMPLE); i++) {
    const row = rows[i]
    if (row && typeof row === 'object') for (const key of Object.keys(row)) names.add(key)
  }
  return [...names].map((name) => ({ name }))
}
