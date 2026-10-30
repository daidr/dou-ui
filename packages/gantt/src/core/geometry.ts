import type { GanttLinkType } from './model'

export interface Point {
  x: number
  y: number
}

/**
 * A path through `points` with straight segments and corners rounded by
 * up to `radius`; a corner never takes more than half of either segment.
 */
export function roundedPath(points: readonly Point[], radius = 4) {
  // drop points that don't turn: repeats and ones on a straight line
  const clean: Point[] = []
  for (const point of points) {
    const last = clean[clean.length - 1]
    if (last && last.x === point.x && last.y === point.y) continue
    const before = clean[clean.length - 2]
    if (
      before &&
      last &&
      ((before.x === last.x && last.x === point.x) || (before.y === last.y && last.y === point.y))
    )
      clean.pop()
    clean.push(point)
  }
  if (!clean.length) return ''
  let d = `M${clean[0]!.x} ${clean[0]!.y}`
  for (let i = 1; i < clean.length - 1; i++) {
    const prev = clean[i - 1]!
    const at = clean[i]!
    const next = clean[i + 1]!
    const into = Math.hypot(at.x - prev.x, at.y - prev.y)
    const out = Math.hypot(next.x - at.x, next.y - at.y)
    const r = Math.min(radius, into / 2, out / 2)
    const a = { x: at.x - ((at.x - prev.x) / into) * r, y: at.y - ((at.y - prev.y) / into) * r }
    const b = { x: at.x + ((next.x - at.x) / out) * r, y: at.y + ((next.y - at.y) / out) * r }
    d += ` L${a.x} ${a.y} Q${at.x} ${at.y} ${b.x} ${b.y}`
  }
  const last = clean[clean.length - 1]!
  return `${d} L${last.x} ${last.y}`
}

/** Where a bar sits on screen, in px. */
export interface BarBox {
  /** Left and right edges; equal for a milestone's centre. */
  left: number
  right: number
  /** Vertical centre. */
  y: number
}

export interface LinkRoute {
  points: Point[]
  /** The arrow's tip, and which way it points: `1` right, `-1` left. */
  tip: Point
  direction: 1 | -1
}

/**
 * The route of a dependency line: out of one end of `from`, into one end
 * of `to`. It leaves and arrives horizontally, `gap` px clear of the bars,
 * and takes a single vertical run when one fits; otherwise it turns back
 * along the boundary between the rows (`rowHeight` apart).
 */
export function routeLink(
  from: BarBox,
  to: BarBox,
  type: GanttLinkType = 'fs',
  rowHeight = 36,
  gap = 12,
): LinkRoute {
  const leavesEnd = type === 'fs' || type === 'ff'
  const entersStart = type === 'fs' || type === 'ss'
  const out = leavesEnd ? 1 : -1
  const into = entersStart ? 1 : -1
  const p = { x: leavesEnd ? from.right : from.left, y: from.y }
  const q = { x: entersStart ? to.left : to.right, y: to.y }
  const a = p.x + out * gap
  const b = q.x - into * gap

  // one vertical run at x works when x is past `a` going out and before `b` coming in
  const low = Math.max(out > 0 ? a : -Infinity, into < 0 ? b : -Infinity)
  const high = Math.min(out < 0 ? a : Infinity, into > 0 ? b : Infinity)
  let points: Point[]
  if (low <= high || from.y === to.y) {
    const x = out > 0 ? low : high
    points = [p, { x, y: p.y }, { x, y: q.y }, q]
  } else {
    const mid = p.y + Math.sign(q.y - p.y) * (rowHeight / 2)
    points = [p, { x: a, y: p.y }, { x: a, y: mid }, { x: b, y: mid }, { x: b, y: q.y }, q]
  }
  return { points, tip: q, direction: into }
}

/** A small solid arrowhead with its tip at `tip`. */
export function arrowPath(tip: Point, direction: 1 | -1, size = 6) {
  const back = tip.x - direction * size
  const half = size / 2 + 0.5
  return `M${tip.x} ${tip.y} L${back} ${tip.y - half} L${back} ${tip.y + half} Z`
}
