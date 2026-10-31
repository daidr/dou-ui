import type { PivotGroupBy } from '../engine/group'
import type {
  PivotConfig,
  PivotDimension,
  PivotFilter,
  PivotShowAs,
  PivotValue,
} from '../engine/types'

/** The four places a field can go. */
export type PivotArea = 'filters' | 'columns' | 'rows' | 'values'
export const AREAS: readonly PivotArea[] = ['filters', 'columns', 'rows', 'values']

/**
 * A field as the panel shows it. `kind` tells where it came from: the list
 * of all fields, an axis, the values or the filters; `index` is its place
 * in `values` for a value.
 */
export interface PivotFieldItem {
  key: string
  kind: 'field' | 'dimension' | 'value' | 'filter'
  /** The field's name; `''` for a count of records. */
  field: string
  index: number
}

export type PivotAreas = Record<PivotArea, PivotFieldItem[]>

const nameOf = (d: PivotDimension) => (typeof d === 'string' ? d : d.field)
const specOf = (d: PivotDimension) => (typeof d === 'string' ? { field: d } : d)
const fieldOfValue = (v: PivotValue) => (typeof v === 'string' ? v : (v.field ?? ''))

/** Whether a filter keeps out anything. */
export const isFiltering = (filter: PivotFilter | undefined) =>
  !!filter &&
  (filter.include !== undefined ||
    (filter.exclude?.length ?? 0) > 0 ||
    !!filter.top ||
    !!filter.between)

/** The fields in each area. A field filtered on an axis stays on its axis, not in the filters. */
export function areasOf(config: PivotConfig): PivotAreas {
  const rows = (config.rows ?? []).map(nameOf)
  const columns = (config.columns ?? []).map(nameOf)
  const onAxis = new Set([...rows, ...columns])
  return {
    rows: rows.map((field, index) => ({ key: `r:${field}`, kind: 'dimension', field, index })),
    columns: columns.map((field, index) => ({
      key: `c:${field}`,
      kind: 'dimension',
      field,
      index,
    })),
    values: (config.values ?? []).map((v, index) => ({
      key: `v:${index}`,
      kind: 'value',
      field: fieldOfValue(v),
      index,
    })),
    filters: Object.keys(config.filters ?? {})
      .filter((field) => !onAxis.has(field))
      .map((field, index) => ({ key: `f:${field}`, kind: 'filter', field, index })),
  }
}

/** The config with the areas as given: what an axis knew of a field (sort, grouping) moves with it. */
export function configOf(areas: PivotAreas, config: PivotConfig): PivotConfig {
  const known = new Map<string, Exclude<PivotDimension, string>>()
  for (const d of [...(config.rows ?? []), ...(config.columns ?? [])])
    known.set(nameOf(d), specOf(d))

  // a field from the list wins over the same field elsewhere on the axes or in the filters
  const fresh = new Set<string>()
  for (const area of ['rows', 'columns', 'filters'] as const)
    for (const item of areas[area]) if (item.kind === 'field') fresh.add(item.field)
  const placed = new Set<string>()
  const axis = (area: 'rows' | 'columns') => {
    const out: PivotDimension[] = []
    for (const item of areas[area]) {
      if (!item.field || placed.has(item.field)) continue
      if (fresh.has(item.field) && item.kind !== 'field') continue
      placed.add(item.field)
      const spec = known.get(item.field)
      out.push(spec && Object.keys(spec).length > 1 ? spec : item.field)
    }
    return out
  }
  const rows = axis('rows')
  const columns = axis('columns')

  const values: PivotValue[] = []
  for (const item of areas.values) {
    if (item.kind === 'value') values.push(config.values![item.index]!)
    else if (item.field) values.push(item.field)
  }

  const filters: Record<string, PivotFilter> = {}
  const old = config.filters ?? {}
  for (const item of areas.filters) {
    if (!item.field || placed.has(item.field) || filters[item.field]) continue
    filters[item.field] = old[item.field] ?? {}
  }
  // a filter goes with its field onto an axis, and away with it
  for (const field of placed) if (old[field]) filters[field] = old[field]

  const next: PivotConfig = { ...config, rows, columns, values, filters }
  if (Object.keys(filters).length === 0) delete next.filters
  // sorting by a column of values only makes sense while those values stay
  if (next.sort && (!values[next.sort.valueIndex] || !sameList(config.columns, next.columns)))
    next.sort = null
  return next
}

const sameList = (a?: readonly PivotDimension[], b?: readonly PivotDimension[]) =>
  (a ?? []).map(nameOf).join('\u0000') === (b ?? []).map(nameOf).join('\u0000')

/** Moves an item to the end of an area (what "移到…" in a field's menu does). */
export function moveItem(
  areas: PivotAreas,
  from: PivotArea | null,
  item: PivotFieldItem,
  to: PivotArea | null,
): PivotAreas {
  const next = { ...areas }
  if (from) next[from] = areas[from].filter((i) => i.key !== item.key)
  if (to) next[to] = [...next[to], item]
  return next
}

/** A dimension with some of its options changed; plain names stay plain while they can. */
export function withDimension(
  config: PivotConfig,
  axis: 'rows' | 'columns',
  field: string,
  patch: { sort?: 'asc' | 'desc'; subtotal?: boolean; by?: PivotGroupBy | null },
): PivotConfig {
  const list = (config[axis] ?? []).map((d) => {
    if (nameOf(d) !== field) return d
    const spec: Exclude<PivotDimension, string> = { ...specOf(d) }
    if (patch.sort !== undefined) spec.sort = patch.sort
    if (patch.subtotal !== undefined) spec.subtotal = patch.subtotal
    if (patch.by === null) delete spec.by
    else if (patch.by !== undefined) spec.by = patch.by
    if (spec.sort === 'asc') delete spec.sort
    if (spec.subtotal === true) delete spec.subtotal
    return Object.keys(spec).length === 1 ? spec.field : spec
  })
  const next: PivotConfig = { ...config, [axis]: list }
  // a filter on the old groups no longer matches once the grouping changes
  if (patch.by !== undefined && config.filters?.[field]) {
    const filters = { ...config.filters }
    filters[field] = {}
    next.filters = filters
  }
  return next
}

/** A value with its way of summing up changed. */
export function withAggregate(config: PivotConfig, index: number, aggregate: string): PivotConfig {
  const values = [...(config.values ?? [])]
  const v = values[index]
  if (v === undefined) return config
  const spec = typeof v === 'string' ? { field: v } : { ...v }
  values[index] = { ...spec, aggregate }
  return { ...config, values }
}

/** A value with its way of showing, its mark or its formula changed; `null` takes one away. */
export function withValue(
  config: PivotConfig,
  index: number,
  patch: {
    show?: PivotShowAs | null
    mark?: 'bar' | 'scale' | null
    formula?: string
    label?: string | null
  },
): PivotConfig {
  const values = [...(config.values ?? [])]
  const v = values[index]
  if (v === undefined) return config
  const spec: Exclude<PivotValue, string> = typeof v === 'string' ? { field: v } : { ...v }
  for (const key of ['show', 'mark', 'formula', 'label'] as const) {
    if (patch[key] === null) delete spec[key]
    else if (patch[key] !== undefined) (spec as Record<string, unknown>)[key] = patch[key]
  }
  const keys = Object.keys(spec)
  values[index] = keys.length === 1 && keys[0] === 'field' ? spec.field! : spec
  return { ...config, values }
}

/** Which groups of a field to keep by their totals: the top (or bottom) N, or a range. */
export type PivotRank = Pick<PivotFilter, 'top' | 'between'>

/** A field's filter with its `top` or `between` set, or both taken away; its lists stay as they are. */
export function withRank(
  config: PivotConfig,
  field: string,
  rank: PivotRank | null,
  inFilters: boolean,
): PivotConfig {
  const next: PivotFilter = { ...config.filters?.[field] }
  delete next.top
  delete next.between
  if (rank?.top) next.top = rank.top
  else if (rank?.between) next.between = rank.between
  return withFilter(config, field, next, inFilters)
}

/** A field's filter replaced; an axis field without a filter left has none. */
export function withFilter(
  config: PivotConfig,
  field: string,
  filter: PivotFilter | null,
  inFilters: boolean,
): PivotConfig {
  const filters = { ...config.filters }
  if (filter && isFiltering(filter)) filters[field] = filter
  else if (inFilters) filters[field] = {}
  else delete filters[field]
  const next: PivotConfig = { ...config, filters }
  if (Object.keys(filters).length === 0) delete next.filters
  return next
}

/** The closest of 1, 2, 5 or 10 times a power of ten. */
function nice(raw: number) {
  const power = 10 ** Math.floor(Math.log10(raw))
  const unit = raw / power
  const m = unit < 1.5 ? 1 : unit < 3.5 ? 2 : unit < 7.5 ? 5 : 10
  return +(m * power).toPrecision(12)
}

/**
 * Round range sizes for a number field: about 10, 5 and 20 ranges over
 * its values, each 1, 2 or 5 times a power of ten.
 */
export function stepsFor(min: number, max: number): number[] {
  const span = max - min
  if (!(span > 0) || !Number.isFinite(span)) return []
  const out = [nice(span / 10), nice(span / 5), nice(span / 20)]
  // oxlint-disable-next-line unicorn/no-array-sort -- sorts a fresh array
  return [...new Set(out)].sort((a, b) => a - b)
}
