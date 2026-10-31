import type { Point, Rect } from './model'

export function boundsOf(rects: readonly Rect[]): Rect | null {
  if (!rects.length) return null
  let left = Infinity
  let top = Infinity
  let right = -Infinity
  let bottom = -Infinity
  for (const rect of rects) {
    left = Math.min(left, rect.x)
    top = Math.min(top, rect.y)
    right = Math.max(right, rect.x + rect.width)
    bottom = Math.max(bottom, rect.y + rect.height)
  }
  return { x: left, y: top, width: right - left, height: bottom - top }
}

export function intersects(a: Rect, b: Rect) {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
}

/** The rectangle spanned by two corners, in any order. */
export function rectFrom(a: Point, b: Point): Rect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  }
}

export const snapTo = (value: number, step: number) =>
  step > 0 ? Math.round(value / step) * step : value

// Alignment guides ------------------------------------------------------------

export interface Guide {
  axis: 'x' | 'y'
  /** The canvas coordinate of the line. */
  at: number
  /** Where the line starts and ends along the other axis. */
  from: number
  to: number
}

export interface SnapResult {
  /** How far to shift the moving box so it lines up. */
  dx: number
  dy: number
  guides: Guide[]
}

const linesX = (r: Rect) => [r.x, r.x + r.width / 2, r.x + r.width]
const linesY = (r: Rect) => [r.y, r.y + r.height / 2, r.y + r.height]

/**
 * A port on a moving node and the port it is connected to. Lining them up
 * makes the edge between them a straight line.
 */
export interface SnapLink {
  /** Where the moving port is before the snap. */
  from: Point
  to: Point
  /** `y` levels ports on the left or right; `x` ports on the top or bottom. */
  axis: 'x' | 'y'
}

/**
 * Lines the moving box up, on each axis separately, when it is within
 * `threshold`: first a port with the port it is connected to, then the
 * nearest edge or centre of another box. Without a match on an axis, the
 * box's top left corner snaps to `grid` instead.
 */
export function snapBox(
  box: Rect,
  others: readonly Rect[],
  { threshold, grid, links = [] }: { threshold: number; grid: number; links?: readonly SnapLink[] },
): SnapResult {
  type Match = { d: number; at: number; link?: SnapLink }
  const best: Record<'x' | 'y', Match | null> = { x: null, y: null }
  const consider = (axis: 'x' | 'y', d: number, at: number, link?: SnapLink) => {
    const current = best[axis]
    if (Math.abs(d) > threshold) return
    // A port lined up with its partner wins over boxes lining up.
    if (current?.link && !link) return
    if (!current || (link && !current.link) || Math.abs(d) < Math.abs(current.d))
      best[axis] = { d, at, link }
  }
  for (const link of links)
    consider(link.axis, link.to[link.axis] - link.from[link.axis], link.to[link.axis], link)
  for (const other of others) {
    for (const from of linesX(box)) for (const to of linesX(other)) consider('x', to - from, to)
    for (const from of linesY(box)) for (const to of linesY(other)) consider('y', to - from, to)
  }
  const dx = best.x ? best.x.d : snapTo(box.x, grid) - box.x
  const dy = best.y ? best.y.d : snapTo(box.y, grid) - box.y
  const moved = { ...box, x: box.x + dx, y: box.y + dy }

  const guides: Guide[] = []
  for (const axis of ['x', 'y'] as const) {
    const match = best[axis]
    if (!match) continue
    const across = axis === 'x' ? 'y' : 'x'
    if (match.link) {
      // From the moved port to its partner.
      const a = match.link.from[across] + (axis === 'x' ? dy : dx)
      const b = match.link.to[across]
      guides.push({ axis, at: match.at, from: Math.min(a, b), to: Math.max(a, b) })
      continue
    }
    // Spanning the moved box and every box it lines up with.
    const lines = axis === 'x' ? linesX : linesY
    const span = [
      moved,
      ...others.filter((r) => lines(r).some((v) => Math.abs(v - match.at) < 0.5)),
    ]
    const start = (r: Rect) => (axis === 'x' ? r.y : r.x)
    const length = (r: Rect) => (axis === 'x' ? r.height : r.width)
    guides.push({
      axis,
      at: match.at,
      from: Math.min(...span.map(start)),
      to: Math.max(...span.map((r) => start(r) + length(r))),
    })
  }
  return { dx, dy, guides }
}
