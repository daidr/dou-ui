/** The value at a dotted path, e.g. `total.amount`; the data itself for an empty path. */
export function valueAt(data: unknown, path: string | undefined): unknown {
  if (!path) return data
  let value = data
  for (const key of path.split('.')) {
    if (value == null || typeof value !== 'object') return undefined
    value = (value as Record<string, unknown>)[key]
  }
  return value
}

/** The rows of a source's data: the data when it is a list, or the list at `path`. */
export function rowsOf(data: unknown, path?: string): Record<string, unknown>[] {
  const value = valueAt(data, path)
  return Array.isArray(value) ? (value as Record<string, unknown>[]) : []
}

/** The keys of the first row of a list, or of an object: the fields to pick from in settings. */
export function fieldsOf(data: unknown): string[] {
  const first = Array.isArray(data) ? data[0] : data
  return first && typeof first === 'object' && !Array.isArray(first) ? Object.keys(first) : []
}

/** The keys whose value in the first row is a number. */
export function numberFieldsOf(data: unknown): string[] {
  const first = Array.isArray(data) ? data[0] : data
  return fieldsOf(data).filter((key) => typeof (first as Record<string, unknown>)[key] === 'number')
}

/** A filter value from a value of the data: dates as `YYYY-MM-DD`, so the filters stay JSON. */
const pad = (n: number) => String(n).padStart(2, '0')

export function filterValueOf(value: unknown): unknown {
  if (!(value instanceof Date)) return value
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`
}
