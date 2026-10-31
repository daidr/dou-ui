import type { DashboardFilters } from './types'

/** Whether a filter value filters nothing: `undefined`, `null`, `''` or an empty array. */
export function isEmptyFilter(value: unknown) {
  return (
    value === undefined ||
    value === null ||
    value === '' ||
    (Array.isArray(value) && value.every(isEmptyFilter))
  )
}

/** The filters without empty values and without `skip`, limited to `keys` when given. */
export function pickFilters(
  filters: DashboardFilters,
  keys?: readonly string[],
  skip?: ReadonlySet<string>,
): DashboardFilters {
  const result: DashboardFilters = {}
  for (const key of keys ?? Object.keys(filters)) {
    const value = filters[key]
    if (!skip?.has(key) && !isEmptyFilter(value)) result[key] = value
  }
  return result
}

/** JSON with object keys in order, so equal filters give equal text. */
export function stableKey(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableKey).join(',')}]`
  if (value && typeof value === 'object') {
    if (value instanceof Date) return JSON.stringify(value)
    // oxlint-disable-next-line unicorn/no-array-sort -- sorts a fresh array
    const keys = Object.keys(value).sort()
    return `{${keys
      .filter((key) => (value as Record<string, unknown>)[key] !== undefined)
      .map((key) => `${JSON.stringify(key)}:${stableKey((value as Record<string, unknown>)[key])}`)
      .join(',')}}`
  }
  return value === undefined ? 'null' : JSON.stringify(value)
}

/** How a filter value reads when no label is given: lists joined with `、`. */
export function filterText(value: unknown): string {
  if (Array.isArray(value)) return value.map(filterText).join('、')
  return value == null ? '' : String(value)
}
