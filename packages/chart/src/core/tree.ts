import { read, type ChartAccessor, type ChartRow } from './data'
import type { Painter, Rect } from './painter'

/*
 * Charts of a tree: what a whole is made of, level by level. A treemap
 * fills a rectangle, each node a rectangle as large as its value, its
 * children inside it; a sunburst draws rings out from a center, each node
 * an arc of its parent's, one ring per level.
 */

export interface TreeNode {
  /** Its place in `nodes`, in the order the tree is walked (parents first). */
  index: number
  name: string
  /** Its own value (a leaf's), or the sum of its children's. */
  value: number
  /** 1 for the top level: the root, which holds the whole, is 0. */
  depth: number
  parent: TreeNode | null
  children: TreeNode[]
  /** The row it was read from; the root has none. */
  row: ChartRow | null
  /** Its row's place among its siblings' rows, as accessors are given it. */
  place: number
  /** The place of its top-level node among the top level, which picks its color. */
  group: number
  /** A treemap's rectangle, or a sunburst's arc (angles and radii). */
  x0: number
  y0: number
  x1: number
  y1: number
}

export interface TreeAccessors {
  label: ChartAccessor
  value: ChartAccessor
  children: ChartAccessor
}

/** The tree read from nested rows, and its nodes walked parents first; nodes without value are left out. */
export function buildTree(
  data: readonly ChartRow[] | undefined,
  { label, value, children }: TreeAccessors,
): { root: TreeNode; nodes: TreeNode[] } {
  const make = (
    row: ChartRow | null,
    place: number,
    depth: number,
    parent: TreeNode | null,
  ): TreeNode => ({
    index: -1,
    name: row ? String(read(row, label, place) ?? '') : '',
    value: 0,
    depth,
    parent,
    children: [],
    row,
    place,
    group: -1,
    x0: 0,
    y0: 0,
    x1: 0,
    y1: 0,
  })
  const root = make(null, -1, 0, null)
  const grow = (node: TreeNode, rows: unknown) => {
    if (!Array.isArray(rows)) return
    rows.forEach((row: ChartRow, i) => {
      const child = make(row, i, node.depth + 1, node)
      const kids = read(row, children, i)
      if (Array.isArray(kids) && kids.length) grow(child, kids)
      if (child.children.length) child.value = child.children.reduce((sum, c) => sum + c.value, 0)
      else {
        const own = Number(read(row, value, i))
        child.value = Number.isFinite(own) && own > 0 ? own : 0
      }
      if (child.value > 0) node.children.push(child)
    })
  }
  grow(root, data)
  root.value = root.children.reduce((sum, c) => sum + c.value, 0)
  const nodes: TreeNode[] = []
  const walk = (node: TreeNode) => {
    node.index = nodes.length
    nodes.push(node)
    for (const child of node.children) walk(child)
  }
  root.children.forEach((top, k) => {
    const mark = (node: TreeNode) => {
      node.group = k
      node.children.forEach(mark)
    }
    mark(top)
  })
  walk(root)
  return { root, nodes }
}

/** The names from the top level down to `node`. */
export function treePath(node: TreeNode): string[] {
  const out: string[] = []
  for (let at: TreeNode | null = node; at && at.depth > 0; at = at.parent) out.unshift(at.name)
  return out
}

/* the treemap */

/** Room above a group's children for its name, in px. */
export const TREE_HEADER = 20
/** Room around a group's children, in px. */
const TREE_PAD = 2
/** The smallest group that gets a header of its own, in px. */
const HEADED = { width: 56, height: 52 }

/**
 * Lays the treemap out in `rect`: each node's rectangle as near a square
 * as can be (the squarified layout), largest first, children inside their
 * group below its header.
 */
export function layoutTreemap(root: TreeNode, rect: Rect) {
  root.x0 = rect.x
  root.y0 = rect.y
  root.x1 = rect.x + rect.width
  root.y1 = rect.y + rect.height
  const place = (node: TreeNode) => {
    if (!node.children.length) return
    let { x0, y0, x1, y1 } = node
    if (node.depth > 0) {
      const headed = x1 - x0 >= HEADED.width && y1 - y0 >= HEADED.height
      x0 += TREE_PAD
      x1 -= TREE_PAD
      y0 += headed ? TREE_HEADER : TREE_PAD
      y1 -= TREE_PAD
    }
    squarify(node.children, x0, y0, Math.max(0, x1 - x0), Math.max(0, y1 - y0))
    node.children.forEach(place)
  }
  place(root)
}

/** Whether a treemap group has room for its header (see `layoutTreemap`). */
export function hasHeader(node: TreeNode) {
  return (
    node.depth > 0 &&
    node.children.length > 0 &&
    node.x1 - node.x0 >= HEADED.width &&
    node.y1 - node.y0 >= HEADED.height
  )
}

function squarify(nodes: TreeNode[], x: number, y: number, width: number, height: number) {
  const list = [...nodes]
  list.sort((a, b) => b.value - a.value)
  const total = list.reduce((sum, n) => sum + n.value, 0)
  if (!(total > 0) || !(width > 0) || !(height > 0)) {
    for (const n of list) [n.x0, n.y0, n.x1, n.y1] = [x, y, x, y]
    return
  }
  // area per unit of value
  const scale = (width * height) / total
  let i = 0
  while (i < list.length) {
    const short = Math.min(width, height)
    // add to the row while it makes its worst rectangle squarer
    let row = [list[i]!]
    let sum = list[i]!.value * scale
    let worst = ratio(row, sum, short, scale)
    let j = i + 1
    while (j < list.length) {
      const next = [...row, list[j]!]
      const nextSum = sum + list[j]!.value * scale
      const w = ratio(next, nextSum, short, scale)
      if (w > worst) break
      row = next
      sum = nextSum
      worst = w
      j++
    }
    // the row along the short side, as thick as it needs
    const thick = sum / short
    let at = 0
    for (const n of row) {
      const length = (n.value * scale) / thick
      if (width >= height) [n.x0, n.y0, n.x1, n.y1] = [x, y + at, x + thick, y + at + length]
      else [n.x0, n.y0, n.x1, n.y1] = [x + at, y, x + at + length, y + thick]
      at += length
    }
    if (width >= height) {
      x += thick
      width -= thick
    } else {
      y += thick
      height -= thick
    }
    i = j
  }
}

/** The worst (largest) side ratio of the rectangles of a row laid along a side `short` long. */
function ratio(row: TreeNode[], sum: number, short: number, scale: number) {
  let lo = Infinity
  let hi = 0
  for (const n of row) {
    const area = n.value * scale
    if (area < lo) lo = area
    if (area > hi) hi = area
  }
  const s2 = sum * sum
  const w2 = short * short
  return Math.max((w2 * hi) / s2, s2 / (w2 * lo))
}

/** The deepest node of a treemap under `(px, py)`. */
export function treemapAt(root: TreeNode, px: number, py: number): TreeNode | null {
  let found: TreeNode | null = null
  let at: TreeNode | undefined = root
  while (at) {
    const inside: TreeNode | undefined = at.children.find(
      (c) => px >= c.x0 && px < c.x1 && py >= c.y0 && py < c.y1,
    )
    if (!inside) break
    found = inside
    at = inside
  }
  return found
}

/**
 * Draws a treemap: a leaf filled with its color, a group a light wash of
 * it under its children. `focus` (a node's index) is ringed.
 */
export function drawTreemap(
  painter: Painter,
  nodes: TreeNode[],
  colors: string[],
  {
    surface,
    ring,
    focus = -1,
    t = 1,
  }: { surface: string; ring: string; focus?: number; t?: number },
) {
  painter.save()
  painter.globalAlpha *= t
  for (const node of nodes) {
    if (node.depth === 0) continue
    const w = node.x1 - node.x0
    const h = node.y1 - node.y0
    // under a pixel: nothing to see, and very many of them are slow to draw
    if (w < 1 || h < 1) continue
    painter.beginPath()
    roundRect(painter, node.x0, node.y0, w, h, w > 8 && h > 8 ? 4 : 0)
    if (node.children.length) {
      painter.save()
      painter.fillStyle = colors[node.index]!
      painter.globalAlpha *= 0.14
      painter.fill()
      painter.restore()
    } else {
      painter.fillStyle = colors[node.index]!
      painter.fill()
    }
  }
  // a hairline of the surface between neighbors, groups and leaves alike
  painter.strokeStyle = surface
  painter.lineWidth = 1
  painter.beginPath()
  for (const node of nodes) {
    if (node.depth === 0) continue
    const w = node.x1 - node.x0
    const h = node.y1 - node.y0
    // square corners on small ones: rounding thousands of them is slow, and unseen
    if (w > 2 && h > 2)
      roundRect(painter, node.x0 + 0.5, node.y0 + 0.5, w - 1, h - 1, w > 8 && h > 8 ? 3.5 : 0)
  }
  painter.stroke()
  painter.restore()
  if (focus >= 0) ringTreemap(painter, nodes[focus], ring)
}

/** Rings a treemap's node: the one under the pointer or picked with the keys. */
export function ringTreemap(painter: Painter, node: TreeNode | undefined, ring: string) {
  if (!node || node.depth === 0) return
  painter.save()
  painter.strokeStyle = ring
  painter.lineWidth = 2
  painter.beginPath()
  roundRect(painter, node.x0 + 1, node.y0 + 1, node.x1 - node.x0 - 2, node.y1 - node.y0 - 2, 3)
  painter.stroke()
  painter.restore()
}

function roundRect(painter: Painter, x: number, y: number, w: number, h: number, r: number) {
  if (w <= 0 || h <= 0) return
  r = Math.max(0, Math.min(r, w / 2, h / 2))
  if (r < 0.5) {
    painter.rect(x, y, w, h)
    return
  }
  painter.moveTo(x + r, y)
  painter.arcTo(x + w, y, x + w, y + h, r)
  painter.arcTo(x + w, y + h, x, y + h, r)
  painter.arcTo(x, y + h, x, y, r)
  painter.arcTo(x, y, x + w, y, r)
  painter.closePath()
}

/* the sunburst */

/**
 * Lays a sunburst out round `(cx, cy)`: the top level in the ring just out
 * of the hole (`inner`), each level a ring further out to `radius`; each
 * node's arc a share of its parent's as its value is of the parent's.
 * Angles run clockwise from 12 o'clock.
 */
export function layoutSunburst(root: TreeNode, inner: number, radius: number) {
  let depth = 0
  const deepest = (node: TreeNode) => {
    if (node.depth > depth) depth = node.depth
    node.children.forEach(deepest)
  }
  deepest(root)
  const ring = depth ? (radius - inner) / depth : 0
  root.x0 = 0
  root.x1 = Math.PI * 2
  root.y0 = 0
  root.y1 = inner
  const place = (node: TreeNode) => {
    let angle = node.x0
    const span = node.x1 - node.x0
    for (const child of node.children) {
      child.x0 = angle
      angle += node.value > 0 ? (child.value / node.value) * span : 0
      child.x1 = angle
      child.y0 = inner + (child.depth - 1) * ring
      child.y1 = child.y0 + ring
      place(child)
    }
  }
  place(root)
}

/** The node of a sunburst under the angle `angle` (clockwise from 12 o'clock) and radius `r`. */
export function sunburstAt(root: TreeNode, angle: number, r: number): TreeNode | null {
  let at: TreeNode | undefined = root
  while (at) {
    const inside: TreeNode | undefined = at.children.find((c) => angle >= c.x0 && angle < c.x1)
    if (!inside) return null
    if (r >= inside.y0 && r < inside.y1) return inside
    at = inside
  }
  return null
}

/** The gap between a sunburst's arcs, in px. */
const ARC_GAP = 1.5

/**
 * Draws a sunburst round `(cx, cy)`, sweeping in with `sweep` (0 to 1).
 * Nodes other than `focus`, its ancestors and its descendants are faded.
 */
/** How much of a sunburst shows off the branch pointed at. */
export const SUNBURST_FADE = 0.4

/** A node with its ancestors and all its descendants: what stays lit when it is pointed at. */
export function sunburstBranch(node: TreeNode): TreeNode[] {
  const out: TreeNode[] = []
  for (let a = node.parent; a; a = a.parent) out.push(a)
  const stack = [node]
  while (stack.length) {
    const n = stack.pop()!
    out.push(n)
    for (const c of n.children) stack.push(c)
  }
  return out
}

export function drawSunburst(
  painter: Painter,
  nodes: TreeNode[],
  colors: string[],
  {
    cx,
    cy,
    surface,
    focus = -1,
    sweep = 1,
  }: { cx: number; cy: number; surface: string; focus?: number; sweep?: number },
) {
  const at = (angle: number) => angle * sweep - Math.PI / 2
  const focused = nodes[focus]
  const lit = (node: TreeNode) => {
    if (!focused) return true
    for (let a: TreeNode | null = node; a; a = a.parent) if (a === focused) return true
    for (let a: TreeNode | null = focused; a; a = a.parent) if (a === node) return true
    return false
  }
  painter.save()
  for (const node of nodes) {
    if (node.depth === 0 || !(node.x1 > node.x0)) continue
    painter.save()
    if (!lit(node)) painter.globalAlpha *= SUNBURST_FADE
    painter.fillStyle = colors[node.index]!
    painter.beginPath()
    painter.arc(cx, cy, node.y1, at(node.x0), at(node.x1))
    painter.arc(cx, cy, node.y0, at(node.x1), at(node.x0), true)
    painter.closePath()
    painter.fill()
    painter.restore()
  }
  // the gaps: rings and spokes of the surface's color
  painter.strokeStyle = surface
  painter.lineWidth = ARC_GAP
  painter.beginPath()
  for (const node of nodes) {
    if (node.depth === 0 || !(node.x1 > node.x0)) continue
    const a = at(node.x0)
    // arcs too thin to show beside a gap run together, but a group's edge stays
    const wide = (node.x1 - node.x0) * sweep * node.y1 >= ARC_GAP * 3
    if (wide || !node.parent || node.parent.depth === 0 || node.x0 === node.parent.x0) {
      painter.moveTo(cx + Math.cos(a) * node.y0, cy + Math.sin(a) * node.y0)
      painter.lineTo(cx + Math.cos(a) * node.y1, cy + Math.sin(a) * node.y1)
    }
    painter.moveTo(cx + Math.cos(at(node.x0)) * node.y0, cy + Math.sin(at(node.x0)) * node.y0)
    painter.arc(cx, cy, node.y0, at(node.x0), at(node.x1))
  }
  painter.stroke()
  painter.restore()
}
