import type { FlowViewport, Point, Rect } from './model'

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

/** Turns `point` by `degrees` around `centre`. */
export function turn(point: Point, centre: Point, degrees: number): Point {
  if (!degrees) return point
  const a = (degrees * Math.PI) / 180
  const dx = point.x - centre.x
  const dy = point.y - centre.y
  return {
    x: centre.x + dx * Math.cos(a) - dy * Math.sin(a),
    y: centre.y + dx * Math.sin(a) + dy * Math.cos(a),
  }
}

/** The box around `rect` turned by `degrees` about its centre. */
export function turnedBox(rect: Rect, degrees: number): Rect {
  if (!degrees) return rect
  const centre = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
  const corners = [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x, y: rect.y + rect.height },
    { x: rect.x + rect.width, y: rect.y + rect.height },
  ].map((corner) => turn(corner, centre, degrees))
  return boundsOf(corners.map((p) => ({ ...p, width: 0, height: 0 })))!
}

/** Whether `box` and `rect` turned by `degrees` about its centre overlap. */
export function intersectsTurned(box: Rect, rect: Rect, degrees: number): boolean {
  if (!degrees) return intersects(box, rect)
  if (!intersects(box, turnedBox(rect, degrees))) return false
  // Upright, the box's axes already part them if they can; the turned
  // rectangle's own axes are the only others that can.
  const centre = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
  const corners = [
    { x: box.x, y: box.y },
    { x: box.x + box.width, y: box.y },
    { x: box.x, y: box.y + box.height },
    { x: box.x + box.width, y: box.y + box.height },
  ].map((corner) => turn(corner, centre, -degrees))
  const xs = corners.map((p) => p.x)
  const ys = corners.map((p) => p.y)
  return (
    Math.min(...xs) < rect.x + rect.width &&
    Math.max(...xs) > rect.x &&
    Math.min(...ys) < rect.y + rect.height &&
    Math.max(...ys) > rect.y
  )
}

/** The part of the canvas a viewport shows on a screen of `size`. */
function viewOf(view: FlowViewport, size: { width: number; height: number }): Rect {
  return {
    x: -view.x / view.zoom,
    y: -view.y / view.zoom,
    width: size.width / view.zoom,
    height: size.height / view.zoom,
  }
}

/** Whether `inner` lies in `outer`, give or take rounding. */
function within(inner: Rect, outer: Rect) {
  const e = 1e-6 * Math.max(1, outer.width, outer.height)
  return (
    inner.x >= outer.x - e &&
    inner.y >= outer.y - e &&
    inner.x + inner.width <= outer.x + outer.width + e &&
    inner.y + inner.height <= outer.y + outer.height + e
  )
}

/**
 * Keeps a pan within reach of the nodes: the view may go as far as having
 * the nodes just leave it on the opposite side, a screen of room to draw in,
 * and no further, so the canvas never runs off to coordinates the browser
 * can't draw (it clamps lengths at about 3.3e7 px, and the layer and the
 * nodes stop lining up long before). With no nodes, the origin is kept in
 * view. A view already outside, e.g. set through `v-model:viewport` or left
 * there when nodes were removed, isn't pulled back: it can only move closer.
 * Zooming in is left as it is: it stays inside the view, so it never goes
 * further out.
 */
export function clampPan(
  next: FlowViewport,
  current: FlowViewport,
  content: Rect | null,
  size: { width: number; height: number },
): FlowViewport {
  if (!size.width || !size.height) return next
  // Zooming in shows part of what is already on screen; keep it as asked,
  // so the point under the pointer or fingers stays put even at the edge.
  if (next.zoom > current.zoom && within(viewOf(next, size), viewOf(current, size))) return next
  const area = content ?? { x: 0, y: 0, width: 0, height: 0 }
  // How far out the view is now, at the new zoom: the same centre.
  const before = {
    x: size.width / 2 - ((size.width / 2 - current.x) / current.zoom) * next.zoom,
    y: size.height / 2 - ((size.height / 2 - current.y) / current.zoom) * next.zoom,
  }
  const axis = (value: number, now: number, start: number, length: number, screen: number) => {
    // `value` is the screen offset of the canvas origin, so the view's near
    // edge on the canvas is -value / zoom: kept between start - screen / zoom
    // (the nodes touch the far edge) and start + length (they touch the near one).
    const lo = 0 - (start + length) * next.zoom
    const hi = screen - start * next.zoom
    return Math.min(Math.max(value, Math.min(lo, now)), Math.max(hi, now))
  }
  return {
    x: axis(next.x, before.x, area.x, area.width, size.width),
    y: axis(next.y, before.y, area.y, area.height, size.height),
    zoom: next.zoom,
  }
}
