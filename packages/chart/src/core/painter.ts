/**
 * What drawing code may use of a 2D context. Series draw only through
 * this, so the same code can later draw into something other than a
 * canvas (an SVG for export) and look the same.
 */
export type Painter = Pick<
  CanvasRenderingContext2D,
  | 'save'
  | 'restore'
  | 'beginPath'
  | 'closePath'
  | 'moveTo'
  | 'lineTo'
  | 'bezierCurveTo'
  | 'rect'
  | 'arc'
  | 'fill'
  | 'stroke'
  | 'clip'
  | 'setLineDash'
  | 'fillStyle'
  | 'strokeStyle'
  | 'lineWidth'
  | 'lineJoin'
  | 'lineCap'
  | 'globalAlpha'
>

/** A rectangle in CSS px. */
export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Moves a coordinate onto the pixel grid so a line `width` CSS px wide
 * covers whole device pixels and stays sharp.
 */
export function crisp(value: number, dpr: number, width = 1): number {
  const device = Math.round(width * dpr)
  const offset = device % 2 === 1 ? 0.5 : 0
  return (Math.round(value * dpr - offset) + offset) / dpr
}

/**
 * Traces a line through the points `px[i], py[i]` into the current path.
 * With `smooth`, a monotone curve: it bends through every point without
 * swinging above or below a neighbor, so a peak in the curve is a peak in
 * the data. `reverse` traces from the last point back to the first (the
 * lower edge of an area); the curve is the same either way.
 */
export function tracePoints(
  painter: Painter,
  px: ArrayLike<number>,
  py: ArrayLike<number>,
  count: number,
  { smooth = false, reverse = false, join = false } = {},
): void {
  if (count === 0) return
  const at = (i: number) => (reverse ? count - 1 - i : i)
  const start = at(0)
  if (join) painter.lineTo(px[start]!, py[start]!)
  else painter.moveTo(px[start]!, py[start]!)
  if (!smooth || count < 3) {
    for (let k = 1; k < count; k++) painter.lineTo(px[at(k)]!, py[at(k)]!)
    return
  }
  const tangents = monotoneTangents(px, py, count)
  for (let k = 1; k < count; k++) {
    const i = at(k - 1)
    const j = at(k)
    const dx = (px[j]! - px[i]!) / 3
    painter.bezierCurveTo(
      px[i]! + dx,
      py[i]! + dx * tangents[i]!,
      px[j]! - dx,
      py[j]! - dx * tangents[j]!,
      px[j]!,
      py[j]!,
    )
  }
}

/** Slopes at each point that keep a cubic curve monotone between points (Fritsch–Carlson). */
export function monotoneTangents(
  px: ArrayLike<number>,
  py: ArrayLike<number>,
  count: number,
): Float64Array {
  const slopes = new Float64Array(Math.max(0, count - 1))
  for (let i = 0; i < count - 1; i++) {
    const dx = px[i + 1]! - px[i]!
    slopes[i] = dx === 0 ? 0 : (py[i + 1]! - py[i]!) / dx
  }
  const tangents = new Float64Array(count)
  tangents[0] = slopes[0] ?? 0
  tangents[count - 1] = slopes[count - 2] ?? 0
  for (let i = 1; i < count - 1; i++) {
    const a = slopes[i - 1]!
    const b = slopes[i]!
    // a turn (or a flat side) keeps the point flat, so the curve can't overshoot it
    tangents[i] = a * b <= 0 ? 0 : (a + b) / 2
  }
  for (let i = 0; i < count - 1; i++) {
    const s = slopes[i]!
    if (s === 0) {
      tangents[i] = tangents[i + 1] = 0
      continue
    }
    const a = tangents[i]! / s
    const b = tangents[i + 1]! / s
    const h = a * a + b * b
    if (h > 9) {
      const t = 3 / Math.sqrt(h)
      tangents[i] = t * a * s
      tangents[i + 1] = t * b * s
    }
  }
  return tangents
}
