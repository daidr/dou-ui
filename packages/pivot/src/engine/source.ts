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

const SAMPLE = 100

/**
 * The records, read field by field into typed arrays the first time each
 * field is used, and kept until the records change.
 */
export class PivotSource<Row = Record<string, unknown>> {
  readonly rows: readonly Row[]
  readonly length: number
  readonly fields: Map<string, PivotResolvedField<Row>>
  private collator: Intl.Collator
  private dimensions = new Map<string, PivotDimensionColumn>()
  private measures = new Map<string, Float64Array>()

  constructor(rows: readonly Row[], options: PivotSourceOptions<Row> = {}) {
    this.rows = rows
    this.length = rows.length
    this.collator = new Intl.Collator(options.locale, { numeric: true })
    this.fields = new Map()
    for (const field of options.fields ?? inferFields(rows)) {
      this.fields.set(field.name, this.resolve(field))
    }
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
    const field = this.field(name)
    const { rows } = this
    const out: unknown[] = Array.from({ length: rows.length })
    const read = field.value
    if (read) for (let i = 0; i < rows.length; i++) out[i] = read(rows[i]!, i)
    else for (let i = 0; i < rows.length; i++) out[i] = (rows[i] as Record<string, unknown>)[name]
    return out
  }

  /** The field grouped by value. */
  dimension(name: string): PivotDimensionColumn {
    let column = this.dimensions.get(name)
    if (!column) {
      column = this.encode(this.field(name))
      this.dimensions.set(name, column)
    }
    return column
  }

  /** The field as numbers, `NaN` where a record has none. */
  measure(name: string): Float64Array {
    let column = this.measures.get(name)
    if (!column) {
      const { rows } = this
      const field = this.field(name)
      column = new Float64Array(rows.length)
      const read = field.value
      for (let i = 0; i < rows.length; i++) {
        const value = read ? read(rows[i]!, i) : (rows[i] as Record<string, unknown>)[name]
        column[i] = toNumber(value)
      }
      this.measures.set(name, column)
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
    const { rows } = this
    let seen = 0
    let type: PivotFieldType | undefined
    for (let i = 0; i < rows.length && seen < SAMPLE; i++) {
      const value = field.value
        ? field.value(rows[i]!, i)
        : (rows[i] as Record<string, unknown>)[field.name]
      if (isEmpty(value)) continue
      seen++
      const kind = typeOf(value)
      if (type && type !== kind) return 'string'
      type = kind
    }
    return type ?? 'string'
  }

  private encode(field: PivotResolvedField<Row>): PivotDimensionColumn {
    const { rows } = this
    const codes = new Uint32Array(rows.length)
    const labels: unknown[] = []
    const byValue = new Map<unknown, number>()
    const byTime = new Map<number, number>()
    let empty = -1
    let last: unknown = undefined
    let lastCode = -1
    const read = field.value
    const name = field.name
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
    for (let i = 0; i < rows.length; i++) {
      const value = read ? read(rows[i]!, i) : (rows[i] as Record<string, unknown>)[name]
      // sorted data repeats itself, so the last lookup is often the answer
      if (value === last && lastCode >= 0) {
        codes[i] = lastCode
        continue
      }
      lastCode = codeOf(value)
      last = value
      codes[i] = lastCode
    }
    const find = (value: unknown) => {
      if (isEmpty(value)) return empty
      if (value instanceof Date) return byTime.get(value.getTime()) ?? -1
      return byValue.get(value) ?? -1
    }
    return { codes, labels, empty, rank: this.rank(labels, field, find), find }
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

/** The fields of records nobody described: every key of the first records. */
function inferFields<Row>(rows: readonly Row[]): PivotField<Row>[] {
  const names = new Set<string>()
  for (let i = 0; i < Math.min(rows.length, SAMPLE); i++) {
    const row = rows[i]
    if (row && typeof row === 'object') for (const key of Object.keys(row)) names.add(key)
  }
  return [...names].map((name) => ({ name }))
}
