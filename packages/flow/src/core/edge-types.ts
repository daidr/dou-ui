import type { CSSProperties } from 'vue'
import type { FlowData, FlowEdge, Point, PortSide } from './model'

/** Where an edge leaves or enters a node: a point and the side it faces. */
export interface EdgeAnchor extends Point {
  side: PortSide
}

export interface EdgeRoute {
  /** The SVG path, in canvas coordinates. */
  path: string
  /** Where the label sits. */
  label: Point
  /**
   * A handle shown on the selected edge that moves part of it, e.g. the
   * middle of a step edge. `axis` is the way it moves; `move` turns the
   * pointer's canvas point into a patch for `edge.data`.
   */
  handle?: { at: Point; axis: 'x' | 'y'; move: (point: Point) => FlowData }
  /**
   * Marks drawn with the edge's stroke but never dashed, e.g. arrowheads:
   * an SVG path in canvas coordinates.
   */
  marks?: string
}

export interface EdgeTypeSpec<Data extends FlowData = FlowData> {
  type: string
  /** The edge's path between two anchors. `edge` is absent while one is being drawn. */
  route: (source: EdgeAnchor, target: EdgeAnchor, edge?: FlowEdge<Data>) => EdgeRoute
  /** The edge's own look, e.g. `strokeDasharray`, over what its port type gives it. */
  style?: (edge: FlowEdge<Data>) => CSSProperties | undefined
}

/** Declares an edge type, with `edge.data` typed. */
export function defineEdgeType<Data extends FlowData = FlowData>(
  spec: EdgeTypeSpec<Data>,
): EdgeTypeSpec<Data> {
  return spec
}

const direction: Record<PortSide, Point> = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  top: { x: 0, y: -1 },
  bottom: { x: 0, y: 1 },
}

const round = (value: number) => Math.round(value * 100) / 100
const fmt = (p: Point) => `${round(p.x)} ${round(p.y)}`
const isVertical = (side: PortSide) => side === 'top' || side === 'bottom'

/**
 * A cubic curve leaving `from` and entering `to` straight out of their
 * sides. The handles are equally long, half the distance along the axis
 * they point in (at least `min`), so a fan of edges from one port is
 * mirror-symmetric and a straight run stays a straight line.
 */
function bezierControls(from: EdgeAnchor, to: EdgeAnchor, min = 40) {
  const a = direction[from.side]
  const b = direction[to.side]
  const span = (dir: Point) => Math.abs(dir.x ? to.x - from.x : to.y - from.y)
  const lenA = Math.max(min, span(a) / 2)
  const lenB = Math.max(min, span(b) / 2)
  return [
    { x: from.x + a.x * lenA, y: from.y + a.y * lenA },
    { x: to.x + b.x * lenB, y: to.y + b.y * lenB },
  ] as const
}

export function bezierPath(from: Point, fromSide: PortSide, to: Point, toSide: PortSide, min = 40) {
  const [c1, c2] = bezierControls({ ...from, side: fromSide }, { ...to, side: toSide }, min)
  return `M${fmt(from)}C${fmt(c1)} ${fmt(c2)} ${fmt(to)}`
}

/** The point halfway along a run of points: a middle one, or between the two middle ones. */
function middle(points: Point[]): Point {
  const a = points[Math.floor((points.length - 1) / 2)]!
  const b = points[Math.ceil((points.length - 1) / 2)]!
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

/**
 * The side a run between two points leaves the first by and the side it
 * enters the second by, along the axis the flow runs in: the one the
 * source's port faces.
 */
function sides(a: Point, b: Point, vertical: boolean): [PortSide, PortSide] {
  if (vertical) return b.y >= a.y ? ['bottom', 'top'] : ['top', 'bottom']
  return b.x >= a.x ? ['right', 'left'] : ['left', 'right']
}

/**
 * A curve through the points an edge runs through, as tidying lays them:
 * straight along a rank, curving across the gaps between ranks.
 */
function bezierThrough(source: EdgeAnchor, target: EdgeAnchor, points: Point[]): EdgeRoute {
  const vertical = isVertical(source.side)
  const all: EdgeAnchor[] = [source, ...points.map((p) => ({ ...p, side: source.side })), target]
  let path = `M${fmt(source)}`
  for (let i = 1; i < all.length; i++) {
    const a = all[i - 1]!
    const b = all[i]!
    const level = vertical ? Math.abs(a.x - b.x) < 0.5 : Math.abs(a.y - b.y) < 0.5
    if (level && i > 1 && i < all.length - 1) {
      path += `L${fmt(b)}`
      continue
    }
    const [out, into] = sides(a, b, vertical)
    const [c1, c2] = bezierControls(
      { ...a, side: i === 1 ? source.side : out },
      { ...b, side: i === all.length - 1 ? target.side : into },
      0,
    )
    path += `C${fmt(c1)} ${fmt(c2)} ${fmt(b)}`
  }
  return { path, label: middle(points) }
}

/** The default: a smooth curve out of and into the ports' sides. */
export const bezierEdge = defineEdgeType({
  type: 'bezier',
  route(source, target, edge) {
    if (edge?.points?.length) return bezierThrough(source, target, edge.points)
    const [c1, c2] = bezierControls(source, target)
    return {
      path: `M${fmt(source)}C${fmt(c1)} ${fmt(c2)} ${fmt(target)}`,
      // The curve at its middle.
      label: {
        x: (source.x + 3 * c1.x + 3 * c2.x + target.x) / 8,
        y: (source.y + 3 * c1.y + 3 * c2.y + target.y) / 8,
      },
    }
  },
})

export const straightEdge = defineEdgeType({
  type: 'straight',
  route: (source, target, edge) =>
    edge?.points?.length
      ? {
          path: `M${[source, ...edge.points, target].map(fmt).join('L')}`,
          label: middle(edge.points),
        }
      : {
          path: `M${fmt(source)}L${fmt(target)}`,
          label: { x: (source.x + target.x) / 2, y: (source.y + target.y) / 2 },
        },
})

/** How far a step edge runs out of a port before its first turn. */
const STUB = 20
const RADIUS = 6

/** A polyline with its corners rounded. */
function rounded(points: Point[], radius = RADIUS) {
  // Drop repeated points and points in the middle of a straight run.
  const pts: Point[] = []
  for (const p of points) {
    const last = pts[pts.length - 1]
    if (last && Math.abs(last.x - p.x) < 0.01 && Math.abs(last.y - p.y) < 0.01) continue
    const before = pts[pts.length - 2]
    if (
      before &&
      last &&
      ((Math.abs(before.x - last.x) < 0.01 && Math.abs(last.x - p.x) < 0.01) ||
        (Math.abs(before.y - last.y) < 0.01 && Math.abs(last.y - p.y) < 0.01))
    )
      pts.pop()
    pts.push(p)
  }
  let d = `M${fmt(pts[0]!)}`
  for (let i = 1; i < pts.length - 1; i++) {
    const [a, b, c] = [pts[i - 1]!, pts[i]!, pts[i + 1]!]
    const lenIn = Math.hypot(b.x - a.x, b.y - a.y)
    const lenOut = Math.hypot(c.x - b.x, c.y - b.y)
    const r = Math.min(radius, lenIn / 2, lenOut / 2)
    const p1 = { x: b.x - ((b.x - a.x) / lenIn) * r, y: b.y - ((b.y - a.y) / lenIn) * r }
    const p2 = { x: b.x + ((c.x - b.x) / lenOut) * r, y: b.y + ((c.y - b.y) / lenOut) * r }
    d += `L${fmt(p1)}Q${fmt(b)} ${fmt(p2)}`
  }
  return d + `L${fmt(pts[pts.length - 1]!)}`
}

const flip = (p: Point): Point => ({ x: p.y, y: p.x })
const flipSide: Record<PortSide, PortSide> = {
  left: 'top',
  right: 'bottom',
  top: 'left',
  bottom: 'right',
}

interface StepData extends FlowData {
  /** Where the middle segment sits between the two ends, from 0 to 1. */
  bend?: number
}

/**
 * Right angles with rounded corners. Between ports that face each other the
 * middle segment can be dragged; its place is kept in `edge.data.bend`.
 */
export const stepEdge = defineEdgeType<StepData>({
  type: 'step',
  route(source, target, edge) {
    if (edge?.points?.length) return stepThrough(source, target, edge.points)
    // Work as if the ports faced left and right, then turn the result back.
    const turned = isVertical(source.side) && isVertical(target.side)
    const s = turned ? { ...flip(source), side: flipSide[source.side] } : source
    const t = turned ? { ...flip(target), side: flipSide[target.side] } : target
    const back = (p: Point) => (turned ? flip(p) : p)
    const ds = direction[s.side]
    const dt = direction[t.side]
    const s1 = { x: s.x + ds.x * STUB, y: s.y + ds.y * STUB }
    const t1 = { x: t.x + dt.x * STUB, y: t.y + dt.y * STUB }
    let points: Point[]
    let label: Point
    let handle: EdgeRoute['handle']

    if (ds.x && dt.x && ds.x === -dt.x && (t.x - s.x) * ds.x > 0) {
      // Facing each other: across, along, across.
      const bend = Math.min(0.95, Math.max(0.05, edge?.data?.bend ?? 0.5))
      const mid = s.x + (t.x - s.x) * bend
      points = [s, { x: mid, y: s.y }, { x: mid, y: t.y }, t]
      label = { x: mid, y: (s.y + t.y) / 2 }
      // No handle when the ends line up: the middle segment has no length.
      if (t.x !== s.x && Math.abs(t.y - s.y) >= 1) {
        const span = t.x - s.x
        const at = back(label)
        handle = {
          at,
          axis: turned ? 'y' : 'x',
          move: (point) => {
            const v = turned ? point.y : point.x
            return { bend: Math.min(0.95, Math.max(0.05, (v - s.x) / span)) }
          },
        }
      }
    } else if (ds.x && dt.x) {
      // Facing away, or the same way: out, around through the middle, in.
      const gap = Math.abs(s.y - t.y)
      const my = gap >= STUB * 2 ? (s.y + t.y) / 2 : Math.max(s.y, t.y) + STUB * 2
      const x1 = ds.x === dt.x ? (ds.x > 0 ? Math.max(s1.x, t1.x) : Math.min(s1.x, t1.x)) : s1.x
      const x2 = ds.x === dt.x ? x1 : t1.x
      points = [s, { x: x1, y: s.y }, { x: x1, y: my }, { x: x2, y: my }, { x: x2, y: t.y }, t]
      label = { x: (x1 + x2) / 2, y: my }
    } else {
      // One across, one along: a single corner when the ends allow it.
      const corner = ds.x ? { x: t1.x, y: s1.y } : { x: s1.x, y: t1.y }
      points = [s, s1, corner, t1, t]
      label = corner
    }
    return { path: rounded(points.map(back)), label: back(label), handle }
  },
})

/**
 * Right angles through the points an edge runs through: along each rank,
 * across each gap between ranks halfway through it.
 */
function stepThrough(source: EdgeAnchor, target: EdgeAnchor, points: Point[]): EdgeRoute {
  const vertical = isVertical(source.side)
  const all = [source, ...points, target]
  const out: Point[] = [source]
  for (let i = 1; i < all.length; i++) {
    const a = all[i - 1]!
    const b = all[i]!
    if (vertical) {
      const y = (a.y + b.y) / 2
      out.push({ x: a.x, y }, { x: b.x, y }, b)
    } else {
      const x = (a.x + b.x) / 2
      out.push({ x, y: a.y }, { x, y: b.y }, b)
    }
  }
  return { path: rounded(out), label: middle(points) }
}
