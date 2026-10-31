/**
 * A way to sum up a field. A state is built per group of records: `add`
 * takes each record's value, `merge` joins two groups' states (subtotals and
 * totals are merged from the groups inside them, never re-read from the
 * records), and `result` turns a state into the number shown.
 */
// oxlint-disable-next-line typescript/no-explicit-any
export interface PivotAggregator<State = any> {
  name: string
  /** The header word, as in "金额 · 求和"; the name when left out. */
  label?: string
  /**
   * What `add` gets: `'number'` the field as a number (records without one
   * are skipped), `'value'` the field's value as it is (empty ones skipped).
   */
  input: 'number' | 'value'
  init: () => State
  add: (state: State, value: never) => State
  merge: (into: State, from: State) => State
  /** `null` or `NaN` for an empty cell. */
  result: (state: State) => number | null
  /** Whether a value is an integer count (written without decimals); `false` by default. */
  integer?: boolean
}

/** Declares a way to sum up a field, for `aggregators` and the config's `aggregate`. */
export function defineAggregator<State, Input extends 'number' | 'value' = 'number'>(
  aggregator: Omit<PivotAggregator<State>, 'add' | 'input'> & {
    input?: Input
    add: (state: State, value: Input extends 'number' ? number : unknown) => State
  },
): PivotAggregator<State> {
  return { input: 'number', ...aggregator } as PivotAggregator<State>
}

/** The built-in ways with a typed-array fast path: one number (or two, for `avg`) per group. */
export type PivotFastAggregate = 'sum' | 'count' | 'avg' | 'min' | 'max'

export const FAST_AGGREGATES: ReadonlySet<string> = new Set(['sum', 'count', 'avg', 'min', 'max'])

/** Counts each value once; the state holds group numbers, so it never compares values. */
export const distinctAggregator: PivotAggregator<Set<number>> = {
  name: 'distinct',
  input: 'value',
  integer: true,
  init: () => new Set(),
  add: (state, code: never) => state.add(code),
  merge: (into, from) => {
    for (const code of from) into.add(code)
    return into
  },
  result: (state) => state.size,
}

export const medianAggregator: PivotAggregator<number[]> = {
  name: 'median',
  input: 'number',
  init: () => [],
  add: (state, value: never) => (state.push(value), state),
  merge: (into, from) => {
    for (let i = 0; i < from.length; i++) into.push(from[i]!)
    return into
  },
  result: (state) => {
    if (state.length === 0) return null
    // oxlint-disable-next-line unicorn/no-array-sort -- sorts its own copy
    const sorted = Float64Array.from(state).sort()
    const mid = sorted.length >> 1
    return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2
  },
}

export const BUILTIN_AGGREGATORS: Readonly<Record<string, PivotAggregator>> = {
  distinct: distinctAggregator as PivotAggregator,
  median: medianAggregator as PivotAggregator,
}
