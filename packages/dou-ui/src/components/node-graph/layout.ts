/**
 * Layered layout for small directed acyclic graphs, flowing left to right,
 * or top to bottom with `direction: 'vertical'`: then the graph is laid out
 * as a horizontal one with x and y swapped, so all below reads "columns"
 * for ranks and "rows" for the lanes across them.
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
   * Where edges meet the node and rows line up, from its top edge (its
   * left edge when vertical). Half the height (width) by default; a tall
   * node passes the middle of its first line.
   */
  anchor?: number
}

export interface LayoutEdge {
  from: string
  to: string
}

export interface LayoutOptions {
  /** `horizontal` flows left to right, `vertical` top to bottom. */
  direction?: 'horizontal' | 'vertical'
  /** Space between ranks (the columns left to right, the rows top to bottom), along the flow. */
  rankGap: number
  /** Space between nodes in a rank, across the flow. */
  laneGap: number
  /** Space between edges passing through a column. */
  edgeGap?: number
  /** Stretch every node along the flow to the longest one in its column. */
  equalWidth?: boolean
  /**
   * The row grid every anchor snaps to, in px. Half the pitch of a
   * one-line node keeps fans symmetric and curves free of small wobbles.
   * Defaults to half the pitch of a 32px node, `(laneGap + 32) / 2`.
   */
  grid?: number
  /**
   * A node joined on one side to a single node besides long edges lines up
   * with that node, so chains run straight and the long edges bend around
   * them. Off, it sits in the middle of all its edges, which keeps every
   * merge symmetric.
   */
  straightChains?: boolean
}

export interface PlacedNode {
  id: string
  /** Which rank the node is in, from 0. */
  rank: number
  x: number
  y: number
  width: number
  height: number
}

export interface PlacedEdge {
  from: string
  to: string
  /**
   * The SVG path, from the right edge of `from` to the left edge of `to`
   * (bottom to top when vertical).
   */
  path: string
  /**
   * Where an edge spanning several ranks runs through the ranks between
   * its ends: the point where it enters each and the one where it leaves
   * it, in order. Empty for an edge between neighbouring ranks.
   */
  points: { x: number; y: number }[]
}

export interface GraphLayout {
  nodes: Map<string, PlacedNode>
  edges: PlacedEdge[]
  /** Edges left out because they would close a cycle. */
  dropped: LayoutEdge[]
  /** The nodes of each rank, in order across the flow. */
  ranks: string[][]
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
  /** A long edge `centreLongEdges` moved into the middle of a fan. */
  centred?: boolean
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
  // A node feeding more than it is fed waits until it is needed: moving
  // it down shortens more edges than it stretches. Sources go first.
  for (let i = order.length - 1; i >= 0; i--) {
    const id = order[i]!
    const next = succs.get(id)!
    if (!next.length || preds.get(id)!.length >= next.length) continue
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

/** Crossings between the edges of `u` and of `v` when `u` sits before `v`, on one side. */
function pairCrossings(u: Item[], v: Item[], position: Map<Item, number>) {
  let count = 0
  for (const a of u) {
    const i = position.get(a)
    if (i === undefined) continue
    for (const b of v) {
      const j = position.get(b)
      if (j !== undefined && i > j) count++
    }
  }
  return count
}

/**
 * Swap neighbours in a column while that leaves fewer crossings with the
 * columns on both sides: sorting by the mean misses what a single swap
 * fixes, e.g. two nodes whose neighbours share a mean.
 */
function transpose(layers: Item[][]) {
  const position = new Map<Item, number>()
  for (const layer of layers) layer.forEach((item, i) => position.set(item, i))
  for (let pass = 0, improved = true; improved && pass < 8; pass++) {
    improved = false
    for (const layer of layers) {
      for (let i = 0; i < layer.length - 1; i++) {
        const u = layer[i]!
        const v = layer[i + 1]!
        const before =
          pairCrossings(u.preds, v.preds, position) + pairCrossings(u.succs, v.succs, position)
        const after =
          pairCrossings(v.preds, u.preds, position) + pairCrossings(v.succs, u.succs, position)
        if (after >= before) continue
        layer[i] = v
        layer[i + 1] = u
        position.set(v, i)
        position.set(u, i + 1)
        improved = true
      }
    }
  }
}

function untangle(layers: Item[][]) {
  let best = layers.map((layer) => [...layer])
  transpose(best)
  let bestCount = totalCrossings(best)
  let current = best.map((layer) => [...layer])
  for (let pass = 0; pass < 12 && bestCount > 0; pass++) {
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
    transpose(current)
    const count = totalCrossings(current)
    if (count < bestCount) {
      bestCount = count
      best = current.map((layer) => [...layer])
    }
  }
  return best
}

const indexOf = (layer: Item[] | undefined) => new Map(layer?.map((item, i) => [item, i]))

/**
 * A long edge that could run on either side of a fan, or between its
 * nodes, at no cost in crossings, goes down the middle: next to items
 * joined to the same places, the long edges move to the middle of the
 * nodes. A fan around a long edge to the node its nodes merge into then
 * lets that edge run straight through, instead of around the outside.
 */
export function centreLongEdges(layers: Item[][]) {
  const result = layers.map((layer) => [...layer])
  result.forEach((layer, c) => {
    const before = indexOf(result[c - 1])
    const after = indexOf(result[c + 1])
    const key = (item: Item) =>
      `${mean(
        item.preds.map((n) => before.get(n) ?? 0),
        -1,
      )}:${mean(
        item.succs.map((n) => after.get(n) ?? 0),
        -1,
      )}`
    // Moving items within this layer only changes the crossings on its two sides.
    const local = () =>
      (c > 0 ? crossings(result[c - 1]!, layer) : 0) +
      (c < result.length - 1 ? crossings(layer, result[c + 1]!) : 0)
    let count = -1
    for (let start = 0; start < layer.length;) {
      let end = start + 1
      while (end < layer.length && key(layer[end]!) === key(layer[start]!)) end++
      const run = layer.slice(start, end)
      const nodes = run.filter((item) => item.edge < 0)
      const edges = run.filter((item) => item.edge >= 0)
      // Only into an even number of nodes: with an odd one the middle is a
      // node, so the edge could not run straight and would only wedge the
      // fan apart on one side.
      if (edges.length && nodes.length >= 2 && nodes.length % 2 === 0) {
        if (count < 0) count = local()
        const half = nodes.length / 2
        layer.splice(start, end - start, ...nodes.slice(0, half), ...edges, ...nodes.slice(half))
        const now = local()
        // Items line up on the same mean position, not the same neighbours:
        // one fed from either side of the edge's source can cross it more
        // often once the edge moves past it. Then the run stays as it was.
        if (now > count) layer.splice(start, end - start, ...run)
        else {
          count = now
          for (const item of edges) item.centred = true
        }
      }
      start = end
    }
  })
  return result
}

/**
 * How many nodes a fan needs before the long edges beyond its outermost
 * nodes are left out of it. With `straight`, a single node already lines
 * up on its own; otherwise a node fanning out to one node and some long
 * edges sits in the middle of all of them.
 */
const fanNodes = (straight: boolean) => (straight ? 1 : 2)

/**
 * Runs of items in a layer fed by one node, or feeding one: the fans,
 * edges passing through between its nodes included. A long edge beyond
 * the outermost nodes is not part of it: it bends away just past the
 * nearest node, instead of mirroring a node on the far side and running
 * half a node further out. Each is the index of its first and last item;
 * a run broken by an item outside the fan is left alone. `outer` is the
 * number of nodes from which those long edges are left out, as `fanNodes`
 * gives it; `Infinity` keeps every long edge in its fan.
 */
function fans(layer: Item[], outer: number) {
  const index = new Map(layer.map((item, i) => [item, i]))
  const seen = new Set<Item>()
  const runs: [number, number][] = []
  for (const item of layer) {
    for (const hub of [...item.preds, ...item.succs]) {
      if (seen.has(hub)) continue
      seen.add(hub)
      for (const side of [hub.succs, hub.preds]) {
        const at = side.flatMap((n) => (index.has(n) ? [index.get(n)!] : []))
        if (at.length < 2) continue
        if (Math.max(...at) - Math.min(...at) + 1 !== at.length) continue
        const nodes = at.filter((i) => layer[i]!.edge < 0)
        const ends = nodes.length >= outer ? nodes : at
        const first = Math.min(...ends)
        const last = Math.max(...ends)
        if (last > first) runs.push([first, last])
      }
    }
  }
  return runs
}

/**
 * The least distance between neighbouring items of a layer, in grid steps.
 */
function spacing(layer: Item[], gap: (a: Item, b: Item) => number, grid: number, outer: number) {
  const steps: number[] = []
  for (let i = 1; i < layer.length; i++) {
    const a = layer[i - 1]!
    const b = layer[i]!
    const span = a.height - a.anchor + gap(a, b) + b.anchor
    let n = Math.max(1, Math.ceil(span / grid - 1e-6))
    // Nodes sit a whole pitch (two steps) apart, as two capsules do, so the
    // middle of any two siblings is on the grid too and a source centred
    // on them fans out symmetrically even when one of them is tall.
    if (a.edge < 0 && b.edge < 0) n += n % 2
    steps.push(n)
  }
  // In a fan the gaps mirror each other: the i-th from either end are both
  // as wide as the wider one, and a gap in the very middle is a whole number
  // of pitches. So its hub sits on the grid right in the middle and the
  // curves pair up even when one node is larger or an edge passes through;
  // only the gaps beside a larger node grow.
  const runs = fans(layer, outer)
  for (let changed = runs.length > 0, pass = 0; changed && pass < 8; pass++) {
    changed = false
    for (const [first, last] of runs) {
      for (let i = first, j = last - 1; i <= j; i++, j--) {
        let n = Math.max(steps[i]!, steps[j]!)
        if (i === j) n += n % 2
        if (steps[i] !== n || steps[j] !== n) changed = true
        steps[i] = steps[j] = n
      }
    }
  }
  // Long edges between two nodes, as `centreLongEdges` puts them, sit right
  // in the middle so they run straight, and only the two nodes stay on the
  // grid: on a coarse grid, putting each edge on it too would take a whole
  // extra step on either side. Laid out as before (`outer` is `Infinity`),
  // everything stays on the grid.
  if (Number.isFinite(outer)) {
    let from = -1
    layer.forEach((item, to) => {
      if (item.edge >= 0) return
      const inner = layer.slice(from + 1, to)
      if (from >= 0 && inner.length && inner.every((n) => n.centred)) {
        const a = layer[from]!
        const b = item
        let between = 0
        for (let k = 1; k < inner.length; k++) between += gap(inner[k - 1]!, inner[k]!)
        const side = Math.max(
          a.height - a.anchor + gap(a, inner[0]!),
          gap(inner.at(-1)!, b) + b.anchor,
        )
        const now = steps.slice(from, to).reduce((sum, n) => sum + n, 0)
        const total = Math.ceil((2 * side + between) / grid - 1e-6)
        const lead = Math.floor((total * grid - between) / 2)
        // Only where centring fits in no more room than before; otherwise
        // (nodes of different sizes, say) the steps stay as they are.
        if (total <= now && lead >= a.height - a.anchor + gap(a, inner[0]!)) {
          steps[from] = lead / grid
          for (let k = 1; k < inner.length; k++)
            steps[from + k] = gap(inner[k - 1]!, inner[k]!) / grid
          steps[to - 1] = total - (lead + between) / grid
        }
      }
      from = to
    })
  }
  return steps
}

/**
 * Move the items of one column as close to their targets as possible,
 * keeping their order and the gaps between them, with every anchor on
 * the row grid. With `s` the offset of each item from the first, in grid
 * steps, `y - s` must not decrease: isotonic regression, solved by
 * pooling adjacent violators, then rounded to whole steps.
 */
function place(
  layer: Item[],
  targets: number[],
  gap: (a: Item, b: Item) => number,
  grid: number,
  outer: number,
) {
  const steps = spacing(layer, gap, grid, outer)
  const offsets: number[] = [0]
  steps.forEach((n, i) => offsets.push(offsets[i]! + n))
  // Long edges can sit between grid rows; nodes never do.
  layer.forEach((item, i) => {
    if (item.edge < 0) offsets[i] = Math.round(offsets[i]!)
  })
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
    for (let k = 0; k < block.count; k++, i++) {
      const y = (z + offsets[i]!) * grid
      // A long edge between rows is a whole number of px from the row; drop the rounding error.
      layer[i]!.y = layer[i]!.edge < 0 ? y : Math.round(y * 1000) / 1000
    }
  }
}

/**
 * The parts of the graph not joined to each other, each as its columns,
 * the part with the most nodes first.
 */
function components(layers: Item[][]) {
  const part = new Map<Item, number>()
  const sizes: number[] = []
  for (const layer of layers) {
    for (const start of layer) {
      if (part.has(start)) continue
      const id = sizes.length
      sizes.push(0)
      const stack = [start]
      part.set(start, id)
      while (stack.length) {
        const item = stack.pop()!
        if (item.edge < 0) sizes[id]!++
        for (const n of [...item.preds, ...item.succs]) {
          if (part.has(n)) continue
          part.set(n, id)
          stack.push(n)
        }
      }
    }
  }
  const order = sizes.map((_, i) => i)
  // oxlint-disable-next-line unicorn/no-array-sort -- sorts a fresh array
  order.sort((a, b) => sizes[b]! - sizes[a]! || a - b)
  return order.map((id) => layers.map((layer) => layer.filter((item) => part.get(item) === id)))
}

/**
 * What a node lines up with on one side. With `straight`, the one node
 * there when it has just one besides long edges, so a chain of nodes stays
 * straight and the long edges bend around it instead.
 */
function lineUp(item: Item, neighbours: Item[], straight: boolean) {
  if (!straight || item.edge >= 0) return neighbours
  const nodes = neighbours.filter((n) => n.edge < 0)
  return nodes.length === 1 ? nodes : neighbours
}

/**
 * What a node is centred on at the end: its fan as `fans` has it, from the
 * first node there to the last, long edges between them included and those
 * beyond left out. While relaxing it still feels those outer long edges, so
 * they pull it and it pulls them back instead of pushing them away.
 */
function fanOf(item: Item, neighbours: Item[], straight: boolean, outer: number) {
  const line = lineUp(item, neighbours, straight)
  if (item.edge >= 0) return line
  const ys = line.filter((n) => n.edge < 0).map((n) => n.y)
  if (ys.length < outer) return line
  const lo = Math.min(...ys)
  const hi = Math.max(...ys)
  return line.filter((n) => n.y >= lo && n.y <= hi)
}

function mean(values: number[], fallback: number) {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : fallback
}

export function layoutGraph(
  nodes: LayoutNode[],
  edges: LayoutEdge[],
  options: LayoutOptions,
): GraphLayout {
  const { rankGap, laneGap, edgeGap = 8, equalWidth = true, straightChains = false } = options
  const vertical = options.direction === 'vertical'
  const grid = options.grid ?? (laneGap + 32) / 2
  // Below, `width` runs along the flow and `height` across it.
  const byId = new Map(
    nodes.map((n) => [n.id, vertical ? { ...n, width: n.height, height: n.width } : n]),
  )
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

  const gap = (a: Item, b: Item) => (a.edge >= 0 && b.edge >= 0 ? edgeGap : laneGap)

  /** Places the ordered columns of one part of the graph. */
  const arrange = (ordered: Item[][], outer: number) => {
    // Start each column stacked around the middle, then relax.
    for (const layer of ordered)
      place(
        layer,
        layer.map(() => 0),
        gap,
        grid,
        outer,
      )
    const relax = (layer: Item[], neighbours: (item: Item) => Item[]) =>
      place(
        layer,
        layer.map((item) =>
          mean(
            lineUp(item, neighbours(item), straightChains).map((n) => n.y),
            item.y,
          ),
        ),
        gap,
        grid,
        outer,
      )
    for (let pass = 0; pass < 4; pass++) {
      for (const layer of ordered.slice(1)) relax(layer, (item) => item.preds)
      for (let i = ordered.length - 2; i >= 0; i--) relax(ordered[i]!, (item) => item.succs)
    }
    for (const layer of ordered) relax(layer, (item) => [...item.preds, ...item.succs])

    // The grid can leave a node half a step off the middle of its fan, when
    // the two ends are an odd number of steps apart. Put it right in the
    // middle where it fits: from the bottom up a node follows what it feeds,
    // then from the top down one fed by more than it feeds follows those.
    // Neighbours stay at least as far apart as placing them asked for, so
    // the gaps in a fan keep mirroring each other.
    const fits = (layer: Item[], steps: number[], i: number, y: number) =>
      (i === 0 || y - layer[i - 1]!.y >= steps[i - 1]! * grid - 1e-6) &&
      (i === layer.length - 1 || layer[i + 1]!.y - y >= steps[i]! * grid - 1e-6)
    const centre = (layer: Item[], side: (item: Item) => Item[]) => {
      const steps = spacing(layer, gap, grid, outer)
      let moved = false
      layer.forEach((item, i) => {
        const ys = fanOf(item, side(item), straightChains, outer).map((n) => n.y)
        // oxlint-disable-next-line unicorn/no-array-sort -- sorts a copy
        ys.sort((a, b) => a - b)
        if (!ys.length) return
        // Only to the middle of a mirror image, never to some uneven mean.
        const y = (ys[0]! + ys.at(-1)!) / 2
        if (ys.some((v, k) => v + ys[ys.length - 1 - k]! !== 2 * y)) return
        if (y === item.y || !Number.isInteger(y) || !fits(layer, steps, i, y)) return
        item.y = y
        moved = true
      })
      return moved
    }
    for (let pass = 0, moved = true; moved && pass < 4; pass++) {
      moved = false
      for (let c = ordered.length - 2; c >= 0; c--)
        moved =
          centre(ordered[c]!, (item) =>
            item.succs.length >= item.preds.length ? item.succs : [],
          ) || moved
      for (const layer of ordered.slice(1))
        moved =
          centre(layer, (item) => (item.preds.length > item.succs.length ? item.preds : [])) ||
          moved
    }
    return ordered
  }

  // Parts of the graph not joined to the rest are laid out on their own,
  // so they never wedge between the nodes of another, then side by side
  // across the flow, the largest first, apart by twice the lane gap.
  const ordered: Item[][] = layers.map(() => [])
  let next = -Infinity
  const extent = (part: Item[][]) => {
    let lo = Infinity
    let hi = -Infinity
    for (const layer of part) {
      for (const item of layer) {
        lo = Math.min(lo, item.y - item.anchor)
        hi = Math.max(hi, item.y - item.anchor + item.height)
      }
    }
    return { lo, hi }
  }
  for (const part of components(layers)) {
    const untangled = untangle(part)
    let arranged = untangled
    // Long edges run down the middle of a fan where that costs nothing,
    // and beyond a fan's outer nodes run close past them instead of
    // mirroring a node on the far side. Both change how everything
    // settles, though, and once in a while let a chain drift away; so the
    // part is also laid out as before, and whichever is narrower wins.
    if (untangled.some((layer) => layer.some((item) => item.edge >= 0))) {
      arranged = centreLongEdges(untangled)
      arrange(arranged, fanNodes(straightChains))
      // Both layouts move the same items, so keep the first one's rows to
      // put them back if it wins.
      const all = arranged.flat()
      const close = all.map((item) => item.y)
      const a = extent(arranged)
      arrange(untangled, Infinity)
      const b = extent(untangled)
      if (a.hi - a.lo <= b.hi - b.lo) all.forEach((item, i) => (item.y = close[i]!))
      else arranged = untangled
    } else arrange(arranged, fanNodes(straightChains))
    const { lo, hi } = extent(arranged)
    const shift = Number.isFinite(next) ? Math.ceil((next - lo) / grid) * grid : 0
    arranged.forEach((layer, c) => {
      for (const item of layer) item.y += shift
      ordered[c]!.push(...layer)
    })
    next = hi + shift + laneGap * 2
  }

  // Columns.
  const widths = ordered.map((layer) =>
    Math.max(0, ...layer.filter((item) => item.edge < 0).map((item) => byId.get(item.id)!.width)),
  )
  const left: number[] = []
  widths.reduce((x, w) => {
    left.push(x)
    return x + w + rankGap
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
      const along = { x: left[c]!, width: equalWidth ? widths[c]! : node.width }
      const across = { y: item.y - item.anchor - top, height: node.height }
      placed.set(item.id, {
        id: item.id,
        rank: c,
        ...(vertical
          ? { x: across.y, y: along.x, width: across.height, height: along.width }
          : { ...along, ...across }),
      })
    }
  })

  // A placed node in flow coordinates: x along, y across.
  const flat = (id: string) => {
    const node = placed.get(id)!
    return vertical ? { x: node.y, y: node.x, width: node.height } : node
  }
  // A point in flow coordinates (x along, y across) as SVG path numbers.
  const at = (x: number, y: number) => (vertical ? `${y} ${x}` : `${x} ${y}`)
  const anchors = new Map([...items.values()].map((item) => [item.id, item.anchor]))
  const placedEdges = dag.edges.map((edge, e) => {
    const chain = chains[e]!
    const from = flat(edge.from)
    const to = flat(edge.to)
    // Points in order: leave `from`, cross every waypoint column, enter `to`.
    const points: [number, number][] = [[from.x + from.width, from.y + anchors.get(edge.from)!]]
    for (const waypoint of chain.slice(1, -1)) {
      const c = Number(waypoint.id.split(':')[1])
      points.push([left[c]!, waypoint.y - top], [left[c]! + widths[c]!, waypoint.y - top])
    }
    points.push([to.x, to.y + anchors.get(edge.to)!])
    let path = `M${at(...points[0]!)}`
    for (let i = 1; i < points.length; i++) {
      const [x1, y1] = points[i - 1]!
      const [x2, y2] = points[i]!
      // Odd steps cross a gap between columns; even ones run along a column.
      if (i % 2 === 0 || y1 === y2) path += `${vertical ? 'V' : 'H'}${x2}`
      else {
        const mid = (x2 - x1) / 2
        path += `C${at(x1 + mid, y1)} ${at(x2 - mid, y2)} ${at(x2, y2)}`
      }
    }
    const through = points.slice(1, -1).map(([x, y]) => (vertical ? { x: y, y: x } : { x, y }))
    return { from: edge.from, to: edge.to, path, points: through }
  })

  let length = widths.length ? left.at(-1)! + widths.at(-1)! : 0
  if (!equalWidth)
    length = Math.max(
      length,
      ...[...placed.values()].map((n) => (vertical ? n.y + n.height : n.x + n.width)),
    )
  return {
    nodes: placed,
    edges: placedEdges,
    dropped: dag.dropped,
    ranks: ordered.map((layer) => layer.filter((item) => item.edge < 0).map((item) => item.id)),
    width: vertical ? bottom - top : length,
    height: vertical ? length : bottom - top,
  }
}
