/**
 * Layered layout for small directed acyclic graphs, flowing left to right.
 *
 * 1. Columns: each node sits one column after its furthest predecessor.
 *    Sources move right to just before their nearest successor.
 * 2. Edges spanning several columns get a waypoint in every column they
 *    cross, so long edges run through the gaps between nodes.
 * 3. Order: nodes in a column are sorted by the mean position of their
 *    neighbours, sweeping back and forth, keeping the order with the
 *    fewest crossings.
 * 4. Rows: every node is pulled towards its neighbours, then spread out
 *    in order with the least total movement (isotonic regression), with
 *    every node's anchor (the middle of its first line) on a row grid of
 *    half a node pitch. A fan sits
 *    symmetrically around its source, and two rows are either level or
 *    a whole step apart, so no curve is a small wobble.
 */

export interface LayoutNode {
  id: string
  width: number
  height: number
  /**
   * Where edges meet the node and rows line up, from its top edge. Half
   * the height by default; a tall node passes the middle of its first line.
   */
  anchor?: number
}

export interface LayoutEdge {
  from: string
  to: string
}

export interface LayoutOptions {
  /** Horizontal space between columns. */
  columnGap: number
  /** Vertical space between nodes in a column. */
  rowGap: number
  /** Vertical space between edges passing through a column. */
  edgeGap?: number
  /** Widen every node to the widest one in its column. */
  equalWidth?: boolean
  /**
   * The row grid every anchor snaps to, in px. Half the pitch of a
   * one-line node keeps fans symmetric and curves free of small wobbles.
   * Defaults to half the pitch of a 32px node, `(rowGap + 32) / 2`.
   */
  grid?: number
}

export interface PlacedNode {
  id: string
  column: number
  x: number
  y: number
  width: number
  height: number
}

export interface PlacedEdge {
  from: string
  to: string
  /** The SVG path, from the right edge of `from` to the left edge of `to`. */
  path: string
}

export interface FlowLayout {
  nodes: Map<string, PlacedNode>
  edges: PlacedEdge[]
  /** Edges left out because they would close a cycle. */
  dropped: LayoutEdge[]
  columns: string[][]
  width: number
  height: number
}

interface Item {
  id: string
  /** The edge index a waypoint belongs to; `-1` for real nodes. */
  edge: number
  height: number
  /** From the top edge to the row the item lines up on. */
  anchor: number
  preds: Item[]
  succs: Item[]
  /** The row the item lines up on. */
  y: number
}

/** Topological order plus the edges that had to be dropped to get one. */
export function acyclic(ids: string[], edges: LayoutEdge[]) {
  const known = new Set(ids)
  const out = new Map<string, string[]>(ids.map((id) => [id, []]))
  const kept: LayoutEdge[] = []
  const dropped: LayoutEdge[] = []
  const seen = new Set<string>()
  for (const edge of edges) {
    const key = `${edge.from}\u0000${edge.to}`
    if (!known.has(edge.from) || !known.has(edge.to) || seen.has(key)) continue
    seen.add(key)
    out.get(edge.from)!.push(edge.to)
  }

  // Depth-first search; an edge back into the current path closes a cycle.
  const state = new Map<string, 1 | 2>()
  const order: string[] = []
  const backEdges = new Set<string>()
  function visit(id: string) {
    state.set(id, 1)
    for (const next of out.get(id)!) {
      const s = state.get(next)
      if (s === 1) backEdges.add(`${id}\u0000${next}`)
      else if (!s) visit(next)
    }
    state.set(id, 2)
    order.push(id)
  }
  for (const id of ids) if (!state.has(id)) visit(id)
  order.reverse()

  for (const edge of edges) {
    const key = `${edge.from}\u0000${edge.to}`
    if (!seen.has(key)) continue
    seen.delete(key)
    if (backEdges.has(key)) dropped.push(edge)
    else kept.push(edge)
  }
  return { order, edges: kept, dropped }
}

/** Each node's column. */
export function rank(order: string[], edges: LayoutEdge[]) {
  const preds = new Map<string, string[]>(order.map((id) => [id, []]))
  const succs = new Map<string, string[]>(order.map((id) => [id, []]))
  for (const { from, to } of edges) {
    preds.get(to)!.push(from)
    succs.get(from)!.push(to)
  }
  const column = new Map<string, number>()
  for (const id of order) {
    column.set(id, Math.max(-1, ...preds.get(id)!.map((p) => column.get(p)!)) + 1)
  }
  // A source feeding only later columns waits until it is needed.
  for (let i = order.length - 1; i >= 0; i--) {
    const id = order[i]!
    const next = succs.get(id)!
    if (preds.get(id)!.length || !next.length) continue
    column.set(id, Math.min(...next.map((s) => column.get(s)!)) - 1)
  }
  return column
}

function crossings(upper: Item[], lower: Item[]) {
  const index = new Map(lower.map((item, i) => [item, i]))
  const pairs: [number, number][] = []
  upper.forEach((item, i) => {
    for (const s of item.succs) {
      const j = index.get(s)
      if (j !== undefined) pairs.push([i, j])
    }
  })
  let count = 0
  for (let a = 0; a < pairs.length; a++) {
    for (let b = a + 1; b < pairs.length; b++) {
      const [i1, j1] = pairs[a]!
      const [i2, j2] = pairs[b]!
      if ((i1 - i2) * (j1 - j2) < 0) count++
    }
  }
  return count
}

function totalCrossings(layers: Item[][]) {
  let count = 0
  for (let i = 0; i < layers.length - 1; i++) count += crossings(layers[i]!, layers[i + 1]!)
  return count
}

function sortByBarycenter(
  layer: Item[],
  neighbours: (item: Item) => Item[],
  position: Map<Item, number>,
) {
  const keyed = layer.map((item, i) => {
    const ns = neighbours(item)
    const key = ns.length ? ns.reduce((sum, n) => sum + position.get(n)!, 0) / ns.length : i
    return { item, key, i }
  })
  keyed.sort((a, b) => a.key - b.key || a.i - b.i)
  return keyed.map((k) => k.item)
}

function untangle(layers: Item[][]) {
  let best = layers.map((layer) => [...layer])
  let bestCount = totalCrossings(best)
  let current = best.map((layer) => [...layer])
  for (let pass = 0; pass < 8 && bestCount > 0; pass++) {
    const down = pass % 2 === 0
    const indices = Array.from(current, (_, i) => (down ? i : current.length - 1 - i))
    for (const i of indices.slice(1)) {
      const ref = current[down ? i - 1 : i + 1]!
      const position = new Map(ref.map((item, j) => [item, j]))
      current[i] = sortByBarycenter(
        current[i]!,
        (item) => (down ? item.preds : item.succs).filter((n) => position.has(n)),
        position,
      )
    }
    const count = totalCrossings(current)
    if (count < bestCount) {
      bestCount = count
      best = current.map((layer) => [...layer])
    }
  }
  return best
}

/**
 * Move the items of one column as close to their targets as possible,
 * keeping their order and the gaps between them, with every anchor on
 * the row grid. With `s` the offset of each item from the first, in grid
 * steps, `y - s` must not decrease: isotonic regression, solved by
 * pooling adjacent violators, then rounded to whole steps.
 */
function place(layer: Item[], targets: number[], gap: (a: Item, b: Item) => number, grid: number) {
  const offsets: number[] = [0]
  for (let i = 1; i < layer.length; i++) {
    const a = layer[i - 1]!
    const b = layer[i]!
    const span = a.height - a.anchor + gap(a, b) + b.anchor
    offsets.push(offsets[i - 1]! + Math.max(1, Math.ceil(span / grid - 1e-6)))
  }
  const blocks: { sum: number; count: number }[] = []
  targets.forEach((t, i) => {
    blocks.push({ sum: t / grid - offsets[i]!, count: 1 })
    while (blocks.length > 1) {
      const last = blocks.at(-1)!
      const prev = blocks.at(-2)!
      if (prev.sum / prev.count <= last.sum / last.count) break
      prev.sum += last.sum
      prev.count += last.count
      blocks.pop()
    }
  })
  let i = 0
  for (const block of blocks) {
    const z = Math.round(block.sum / block.count)
    for (let k = 0; k < block.count; k++, i++) layer[i]!.y = (z + offsets[i]!) * grid
  }
}

function mean(values: number[], fallback: number) {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : fallback
}

export function layoutFlow(
  nodes: LayoutNode[],
  edges: LayoutEdge[],
  options: LayoutOptions,
): FlowLayout {
  const { columnGap, rowGap, edgeGap = 8, equalWidth = true } = options
  const grid = options.grid ?? (rowGap + 32) / 2
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const ids = [...byId.keys()]
  const dag = acyclic(ids, edges)
  const column = rank(dag.order, dag.edges)
  const count = Math.max(0, ...column.values()) + (ids.length ? 1 : 0)

  // Items, in input order within each column.
  const items = new Map<string, Item>()
  const layers: Item[][] = Array.from({ length: count }, () => [])
  for (const id of ids) {
    const { height, anchor = height / 2 } = byId.get(id)!
    const item: Item = { id, edge: -1, height, anchor, preds: [], succs: [], y: 0 }
    items.set(id, item)
    layers[column.get(id)!]!.push(item)
  }
  const chains: Item[][] = dag.edges.map((edge, e) => {
    const chain = [items.get(edge.from)!]
    for (let c = column.get(edge.from)! + 1; c < column.get(edge.to)!; c++) {
      const waypoint: Item = {
        id: `${e}:${c}`,
        edge: e,
        height: 0,
        anchor: 0,
        preds: [],
        succs: [],
        y: 0,
      }
      layers[c]!.push(waypoint)
      chain.push(waypoint)
    }
    chain.push(items.get(edge.to)!)
    for (let i = 0; i < chain.length - 1; i++) {
      chain[i]!.succs.push(chain[i + 1]!)
      chain[i + 1]!.preds.push(chain[i]!)
    }
    return chain
  })

  const ordered = untangle(layers)
  const gap = (a: Item, b: Item) => (a.edge >= 0 && b.edge >= 0 ? edgeGap : rowGap)

  // Start each column stacked around the middle, then relax.
  for (const layer of ordered)
    place(
      layer,
      layer.map(() => 0),
      gap,
      grid,
    )
  const relax = (layer: Item[], neighbours: (item: Item) => Item[]) =>
    place(
      layer,
      layer.map((item) =>
        mean(
          neighbours(item).map((n) => n.y),
          item.y,
        ),
      ),
      gap,
      grid,
    )
  for (let pass = 0; pass < 4; pass++) {
    for (const layer of ordered.slice(1)) relax(layer, (item) => item.preds)
    for (let i = ordered.length - 2; i >= 0; i--) relax(ordered[i]!, (item) => item.succs)
  }
  for (const layer of ordered) relax(layer, (item) => [...item.preds, ...item.succs])

  // Columns.
  const widths = ordered.map((layer) =>
    Math.max(0, ...layer.filter((item) => item.edge < 0).map((item) => byId.get(item.id)!.width)),
  )
  const left: number[] = []
  widths.reduce((x, w) => {
    left.push(x)
    return x + w + columnGap
  }, 0)

  let top = Infinity
  let bottom = -Infinity
  for (const layer of ordered) {
    for (const item of layer) {
      top = Math.min(top, item.y - item.anchor)
      bottom = Math.max(bottom, item.y - item.anchor + item.height)
    }
  }
  if (!Number.isFinite(top)) top = bottom = 0

  const placed = new Map<string, PlacedNode>()
  ordered.forEach((layer, c) => {
    for (const item of layer) {
      if (item.edge >= 0) continue
      const node = byId.get(item.id)!
      placed.set(item.id, {
        id: item.id,
        column: c,
        x: left[c]!,
        y: item.y - item.anchor - top,
        width: equalWidth ? widths[c]! : node.width,
        height: node.height,
      })
    }
  })

  const anchors = new Map([...items.values()].map((item) => [item.id, item.anchor]))
  const placedEdges = dag.edges.map((edge, e) => {
    const chain = chains[e]!
    const from = placed.get(edge.from)!
    const to = placed.get(edge.to)!
    // Points in order: leave `from`, cross every waypoint column, enter `to`.
    const points: [number, number][] = [[from.x + from.width, from.y + anchors.get(from.id)!]]
    for (const waypoint of chain.slice(1, -1)) {
      const c = Number(waypoint.id.split(':')[1])
      points.push([left[c]!, waypoint.y - top], [left[c]! + widths[c]!, waypoint.y - top])
    }
    points.push([to.x, to.y + anchors.get(to.id)!])
    let path = `M${points[0]![0]} ${points[0]![1]}`
    for (let i = 1; i < points.length; i++) {
      const [x1, y1] = points[i - 1]!
      const [x2, y2] = points[i]!
      // Odd steps cross a gap between columns; even ones run along a column.
      if (i % 2 === 0 || y1 === y2) path += `H${x2}`
      else {
        const mid = (x2 - x1) / 2
        path += `C${x1 + mid} ${y1} ${x2 - mid} ${y2} ${x2} ${y2}`
      }
    }
    return { from: edge.from, to: edge.to, path }
  })

  const width = widths.length ? left.at(-1)! + widths.at(-1)! : 0
  return {
    nodes: placed,
    edges: placedEdges,
    dropped: dag.dropped,
    columns: ordered.map((layer) => layer.filter((item) => item.edge < 0).map((item) => item.id)),
    width: equalWidth ? width : Math.max(width, ...[...placed.values()].map((n) => n.x + n.width)),
    height: bottom - top,
  }
}
