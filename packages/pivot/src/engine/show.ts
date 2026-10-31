import type { PivotTree } from './tree'
import type { PivotShow, PivotShowAs } from './types'

/** A way of showing a value with its axis worked out. */
export interface PivotResolvedShow {
  as: PivotShowAs
  axis: 'rows' | 'columns'
}

const ON_COLUMNS: ReadonlySet<PivotShowAs> = new Set([
  'difference',
  'percentDifference',
  'runningTotal',
])

/** The axis a way of showing works along: as given, or the default when that axis has fields. */
export function resolveShow(
  show: PivotShow,
  rows: PivotTree,
  columns: PivotTree,
): PivotResolvedShow {
  let axis = show.axis ?? (ON_COLUMNS.has(show.as) ? 'columns' : 'rows')
  const has = (on: 'rows' | 'columns') => (on === 'rows' ? rows : columns).levels.length > 0
  if (!show.axis && !has(axis) && has(axis === 'rows' ? 'columns' : 'rows')) {
    axis = axis === 'rows' ? 'columns' : 'rows'
  }
  return { as: show.as, axis }
}

/** Where each group sits among all the children (its index in `children`). */
const places = new WeakMap<PivotTree, Int32Array>()
function placeOf(tree: PivotTree) {
  let place = places.get(tree)
  if (!place) {
    place = new Int32Array(tree.size)
    tree.children.forEach((node, at) => (place![node] = at))
    places.set(tree, place)
  }
  return place
}

/**
 * Works out a value as it is shown, from the summed-up values (`get`).
 * Groups come in their label order, whatever order the rows are shown in.
 */
export class PivotShown {
  private running = new Map<number, number>()
  private sorted = new Map<number, Float64Array>()

  constructor(
    readonly show: PivotResolvedShow,
    private rows: PivotTree,
    private columns: PivotTree,
    private get: (row: number, column: number) => number,
  ) {}

  value(row: number, column: number): number {
    const { get, show } = this
    const v = get(row, column)
    switch (show.as) {
      case 'percentOfTotal':
        return ratio(v, get(0, 0))
      case 'percentOfRow':
        return ratio(v, get(row, 0))
      case 'percentOfColumn':
        return ratio(v, get(0, column))
      case 'percentOfParent': {
        if (show.axis === 'rows') return ratio(v, get(row > 0 ? this.rows.parent[row]! : 0, column))
        return ratio(v, get(row, column > 0 ? this.columns.parent[column]! : 0))
      }
      case 'difference':
      case 'percentDifference': {
        const prev = this.previous(row, column)
        if (prev === null) return Number.NaN
        const p = show.axis === 'rows' ? get(prev, column) : get(row, prev)
        if (show.as === 'difference') return v - p
        return p === 0 ? Number.NaN : (v - p) / Math.abs(p)
      }
      case 'runningTotal':
        return this.runningTotal(row, column)
      case 'rank':
        return this.rank(row, column, v)
    }
  }

  /** The group before this one on the axis, or null for the first and for totals. */
  private previous(row: number, column: number): number | null {
    const tree = this.show.axis === 'rows' ? this.rows : this.columns
    const node = this.show.axis === 'rows' ? row : column
    if (node <= 0) return null
    const at = placeOf(tree)[node]!
    return at > tree.childStart[tree.parent[node]!]! ? tree.children[at - 1]! : null
  }

  private runningTotal(row: number, column: number) {
    const onRows = this.show.axis === 'rows'
    const tree = onRows ? this.rows : this.columns
    const node = onRows ? row : column
    const other = onRows ? column : row
    const read = (n: number) => (onRows ? this.get(n, other) : this.get(other, n))
    if (node <= 0) return read(node)
    const key = (n: number) => n * (onRows ? this.columns.size : this.rows.size) + other
    const cached = this.running.get(key(node))
    if (cached !== undefined) return cached
    // add up from the first group (or the last one worked out) to this one
    const place = placeOf(tree)
    const first = tree.childStart[tree.parent[node]!]!
    let at = place[node]!
    while (at > first && !this.running.has(key(tree.children[at - 1]!))) at--
    let total = at > first ? this.running.get(key(tree.children[at - 1]!))! : Number.NaN
    for (; at <= place[node]!; at++) {
      const n = tree.children[at]!
      const v = read(n)
      if (v === v) total = total === total ? total + v : v
      this.running.set(key(n), total)
    }
    return total
  }

  private rank(row: number, column: number, v: number) {
    if (v !== v) return Number.NaN
    const onRows = this.show.axis === 'rows'
    const tree = onRows ? this.rows : this.columns
    const node = onRows ? row : column
    if (node <= 0) return Number.NaN
    const other = onRows ? column : row
    const parent = tree.parent[node]!
    const key = parent * (onRows ? this.columns.size : this.rows.size) + other
    let values = this.sorted.get(key)
    if (!values) {
      const list: number[] = []
      for (let k = tree.childStart[parent]!; k < tree.childStart[parent + 1]!; k++) {
        const n = tree.children[k]!
        const x = onRows ? this.get(n, other) : this.get(other, n)
        if (x === x) list.push(x)
      }
      values = Float64Array.from(list)
      // oxlint-disable-next-line unicorn/no-array-sort -- sorts a fresh array
      values.sort()
      this.sorted.set(key, values)
    }
    // how many are larger: those after the last one not larger, found by bisection
    let lo = 0
    let hi = values.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (values[mid]! <= v) lo = mid + 1
      else hi = mid
    }
    return values.length - lo + 1
  }
}

const ratio = (a: number, b: number) => (b === 0 || b !== b || a !== a ? Number.NaN : a / b)
