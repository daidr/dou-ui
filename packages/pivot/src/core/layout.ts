import type { PivotResult, PivotTree } from '../engine'
import type { PivotCollapsed, PivotPath } from '../engine/types'

/**
 * One row, or one column, of the table: a group (or the grand total), and
 * which value it shows when the values run along this axis.
 */
export interface PivotLine {
  node: number
  /**
   * `group`: a group's own line (its cells hold its total); `subtotal`: the
   * column after an open column group that holds its total; `total`: the
   * grand total.
   */
  kind: 'group' | 'subtotal' | 'total'
  /** The value's place in `values`, or -1 when the values run along the other axis. */
  value: number
}

/** A header cell over the columns `from` up to (not including) `to`. */
export interface PivotHeaderSpan {
  from: number
  to: number
  /** The header row it starts in, and how many it covers. */
  level: number
  rows: number
  node: number
  kind: PivotLine['kind'] | 'value'
  value: number
}

/** The nodes of collapsed paths; paths that no longer match a group are skipped. */
export function collapsedNodes(tree: PivotTree, paths: readonly PivotPath[] | undefined) {
  const nodes = new Set<number>()
  for (const path of paths ?? []) {
    const node = tree.find(path)
    if (node > 0) nodes.add(node)
  }
  return nodes
}

export interface PivotLinesOptions {
  /** How many values run along this axis (1 when they run along the other one). */
  values: number
  /** Whether the values run along this axis. */
  valuesHere: boolean
  /** Whether the grand total gets a line. */
  total: boolean
  /**
   * Rows only: an open group's total goes on a line of its own after its
   * children (the tabular layout), instead of on the group's own line.
   */
  totalsAfter?: boolean
}

/**
 * The rows of the table, top to bottom, without the grand total: each open
 * group is followed by its children; a group's own row holds its total
 * (or, with `totalsAfter`, a row after its children does).
 */
export function rowLines(
  tree: PivotTree,
  order: Int32Array,
  collapsed: ReadonlySet<number>,
  options: PivotLinesOptions,
): PivotLine[] {
  const lines: PivotLine[] = []
  const push = (node: number, kind: PivotLine['kind']) => {
    if (options.valuesHere)
      for (let v = 0; v < options.values; v++) lines.push({ node, kind, value: v })
    else lines.push({ node, kind, value: -1 })
  }
  if (tree.levels.length === 0) return lines
  const { childStart, depth, levels } = tree
  const visit = (node: number) => {
    for (let at = childStart[node]!; at < childStart[node + 1]!; at++) {
      const child = order[at]!
      const open = !collapsed.has(child) && tree.isGroup(child)
      if (open && options.totalsAfter) {
        visit(child)
        if (levels[depth[child]! - 1]!.subtotal) push(child, 'subtotal')
        continue
      }
      push(child, 'group')
      if (open) visit(child)
    }
  }
  visit(0)
  return lines
}

/** The grand total row(s), kept apart so they can stay at the bottom. */
export function totalLines(tree: PivotTree, options: PivotLinesOptions): PivotLine[] {
  if (tree.levels.length > 0 && !options.total) return []
  if (options.valuesHere)
    return Array.from({ length: options.values }, (_, v) => ({ node: 0, kind: 'total', value: v }))
  return [{ node: 0, kind: 'total', value: -1 }]
}

/**
 * The columns of the table, left to right: an open group's children and
 * then, when its field has subtotals, a column with its total; a closed
 * group is one column; the grand total comes last.
 */
export function columnLines(
  tree: PivotTree,
  collapsed: ReadonlySet<number>,
  options: PivotLinesOptions,
): PivotLine[] {
  const lines: PivotLine[] = []
  const push = (node: number, kind: PivotLine['kind']) => {
    if (options.valuesHere)
      for (let v = 0; v < options.values; v++) lines.push({ node, kind, value: v })
    else lines.push({ node, kind, value: -1 })
  }
  if (tree.levels.length === 0) {
    push(0, 'total')
    return lines
  }
  const { childStart, children, depth, levels } = tree
  const visit = (node: number) => {
    for (let at = childStart[node]!; at < childStart[node + 1]!; at++) {
      const child = children[at]!
      if (!collapsed.has(child) && tree.isGroup(child)) {
        visit(child)
        if (levels[depth[child]! - 1]!.subtotal) push(child, 'subtotal')
      } else push(child, 'group')
    }
  }
  visit(0)
  if (options.total) push(0, 'total')
  return lines
}

/**
 * The header cells over the columns, one list per header row. Each field
 * of the columns is a row; a group spans its children; a closed group, a
 * subtotal and the grand total reach down to the values row. The values
 * row names each column's value; without it, the cells reach one row
 * further down instead (the header keeps a row for the row fields).
 */
export function headerSpans(
  tree: PivotTree,
  lines: readonly PivotLine[],
  valueRow: boolean,
): PivotHeaderSpan[][] {
  const fields = tree.levels.length
  const rows = fields + (valueRow ? 1 : 0)
  const spans: PivotHeaderSpan[][] = Array.from({ length: rows }, () => [])
  const reach = valueRow ? fields : fields + 1
  const chain = new Int32Array(fields + 1)
  lines.forEach((line, i) => {
    const own = line.kind === 'total' ? 0 : tree.depth[line.node]!
    for (let at = line.node, d = own; d >= 0; d--, at = tree.parent[at]!) chain[d] = at
    for (let level = 0; level < fields; level++) {
      let node: number
      let kind: PivotHeaderSpan['kind']
      let height = 1
      if (line.kind === 'total') {
        if (level > 0) break
        node = 0
        kind = 'total'
        height = reach
      } else if (level < own - 1) {
        node = chain[level + 1]!
        kind = 'group'
      } else if (level === own - 1) {
        node = line.node
        kind = line.kind
        height = reach - own + 1
      } else break
      const list = spans[level]!
      const last = list[list.length - 1]
      if (last && last.to === i && last.node === node && last.kind === kind) last.to = i + 1
      else list.push({ from: i, to: i + 1, level, rows: height, node, kind, value: -1 })
    }
    if (valueRow) {
      spans[fields]!.push({
        from: i,
        to: i + 1,
        level: fields,
        rows: 1,
        node: line.node,
        kind: 'value',
        value: line.value,
      })
    }
  })
  return spans
}

/** The spans that reach into the columns `from` to `to`. */
export function spansIn(list: readonly PivotHeaderSpan[], from: number, to: number) {
  // spans are in order and do not overlap: find the first that ends after `from`
  let low = 0
  let high = list.length
  while (low < high) {
    const mid = (low + high) >> 1
    if (list[mid]!.to <= from) low = mid + 1
    else high = mid
  }
  const out: PivotHeaderSpan[] = []
  for (let i = low; i < list.length && list[i]!.from < to; i++) out.push(list[i]!)
  return out
}

/** Paths of every group at `depth` and deeper (to collapse a level), or of every group. */
export function groupPaths(tree: PivotTree, depth = 1): PivotPath[] {
  const out: PivotPath[] = []
  for (let node = 1; node < tree.size; node++) {
    if (tree.depth[node]! >= depth && tree.isGroup(node)) out.push(tree.path(node))
  }
  return out
}

/** Whether two paths are the same groups; dates match by time. */
export function samePath(a: PivotPath, b: PivotPath) {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    const x = a[i]
    const y = b[i]
    if (x === y) continue
    if (x instanceof Date && y instanceof Date && x.getTime() === y.getTime()) continue
    return false
  }
  return true
}

export type PivotAxis = keyof PivotCollapsed

/** The cell value of a row line and a column line. */
export function cellValue(result: PivotResult, row: PivotLine, column: PivotLine) {
  return result.get(row.node, column.node, row.value >= 0 ? row.value : Math.max(0, column.value))
}
