/** The values a list of options offers, through groups (`options`) and levels (`children`). */
function valuesOf(options: readonly unknown[], into = new Set<unknown>()) {
  for (const option of options) {
    if (option === null || typeof option !== 'object') {
      into.add(option)
      continue
    }
    const record = option as { value?: unknown; options?: unknown; children?: unknown }
    if ('value' in record) into.add(record.value)
    if (Array.isArray(record.options)) valuesOf(record.options, into)
    if (Array.isArray(record.children)) valuesOf(record.children, into)
  }
  return into
}

/**
 * A value narrowed to what the options offer: a single value the options
 * lack becomes `null`, and a list keeps only the items they have. The
 * same value comes back when nothing is lost.
 */
export function fitToOptions(value: unknown, options: readonly unknown[]): unknown {
  if (value === null || value === undefined) return value
  const offered = valuesOf(options)
  if (Array.isArray(value)) {
    const kept = value.filter((item) => offered.has(item))
    return kept.length === value.length ? value : kept
  }
  return offered.has(value) ? value : null
}

/** Whether a path of values, one per level, runs through the options' `children`. */
function hasPath(path: readonly unknown[], options: readonly unknown[]): boolean {
  let level: readonly unknown[] = options
  for (const step of path) {
    const option = level.find(
      (entry) =>
        entry !== null &&
        typeof entry === 'object' &&
        (entry as { value?: unknown }).value === step,
    ) as { children?: unknown } | undefined
    if (!option) return false
    level = Array.isArray(option.children) ? option.children : []
  }
  return true
}

/**
 * Like `fitToOptions`, for a value that is a path through levels of
 * options, or a list of such paths.
 */
export function fitPathToOptions(value: unknown, options: readonly unknown[]): unknown {
  if (!Array.isArray(value) || value.length === 0) return value
  if (Array.isArray(value[0])) {
    const kept = value.filter((path) => Array.isArray(path) && hasPath(path, options))
    return kept.length === value.length ? value : kept
  }
  return hasPath(value, options) ? value : null
}
