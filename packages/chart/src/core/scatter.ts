import { yColumn, type ChartAccessor } from './data'
import type { Painter } from './painter'
import { eachNear, pointGrid } from './grid'
import { nearestPoint } from './hit'
import type { ChartHit, ChartSeries, ChartSeriesKind, ChartView } from './series'

export interface ScatterStyle {
  /** The bubble size of each row; the area of a bubble grows with it. */
  size?: ChartAccessor
  /** Dot radius in px; with `size`, the radius of the largest bubble. */
  radius?: number
}

/** The radius of the largest bubble, unless set. */
const BUBBLE = 24
/** The smallest bubble radius, so small values still show. */
const MIN_BUBBLE = 2
/** From this many dots on, they are stamped into one image instead of drawn one by one. */
const MANY = 2000

const orders = new WeakMap<Float64Array, Int32Array>()
/** Indices from the largest size to the smallest, so small bubbles stay on top. */
function largestFirst(sizes: Float64Array): Int32Array {
  let order = orders.get(sizes)
  if (!order) {
    order = Int32Array.from(sizes, (_, i) => i)
    // the `|| 0` keeps NaN (no size) at the end
    // oxlint-disable-next-line unicorn/no-array-sort -- sorts its own array
    order.sort((a, b) => (sizes[b]! || 0) - (sizes[a]! || 0))
    orders.set(sizes, order)
  }
  return order
}

/**
 * Draws a dot at each point; with `size`, a bubble whose area is its size.
 * Dots are a little see-through so dots on top of each other show darker;
 * bubbles are lighter, with an edge, so they read through each other.
 * From a few thousand dots on, they are stamped into one image: quicker
 * by far, though a pile of dots is then no darker than one.
 */
/** Where row `i` is drawn; `null` when it has no value or is well outside the plot. */
function pointOf(series: ChartSeries<ScatterStyle>, { x: sx, y: sy, plot, horizontal }: ChartView) {
  const xs = series.x.values
  const ys = series.top
  return (i: number): [number, number] | null => {
    const x = xs[i]!
    const y = ys[i]!
    if (x !== x || y !== y) return null
    const u = sx.map(x)
    const v = sy.map(y)
    const [px, py] = horizontal ? [v, u] : [u, v]
    // a little room outside the plot so dots on the edge show whole
    if (px < plot.x - 8 || px > plot.x + plot.width + 8) return null
    if (py < plot.y - 8 || py > plot.y + plot.height + 8) return null
    return [px, py]
  }
}

/** The radius of a bubble of each size: its area grows with the size. */
function bubbleRadius(sizes: Float64Array, max = BUBBLE) {
  let largest = 0
  for (let i = 0; i < sizes.length; i++) if (sizes[i]! > largest) largest = sizes[i]!
  return (size: number) =>
    largest > 0 ? Math.max(MIN_BUBBLE, max * Math.sqrt(size / largest)) : MIN_BUBBLE
}

const DOT = 3.5

export function drawScatter(painter: Painter, series: ChartSeries<ScatterStyle>, view: ChartView) {
  const { plot } = view
  const xs = series.x.values
  const ys = series.top
  const sizeKey = series.props.size
  const sizes = sizeKey === undefined ? null : yColumn(series.rows, sizeKey)
  const n = Math.min(xs.length, ys.length)

  const point = pointOf(series, view)

  painter.save()
  painter.fillStyle = series.color
  painter.strokeStyle = series.color

  if (sizes) {
    const radius = bubbleRadius(sizes, series.props.radius)
    painter.lineWidth = 1
    // one at a time: each bubble's edge goes over the fill of those under it
    for (const i of largestFirst(sizes)) {
      if (i >= n) continue
      const size = sizes[i]!
      if (!(size >= 0)) continue
      const at = point(i)
      if (!at) continue
      const r = radius(size)
      painter.beginPath()
      painter.moveTo(at[0] + r, at[1])
      painter.arc(at[0], at[1], r, 0, Math.PI * 2)
      painter.globalAlpha = 0.36
      painter.fill()
      painter.globalAlpha = 0.9
      painter.stroke()
    }
    painter.restore()
    return
  }

  const r = series.props.radius ?? DOT
  painter.globalAlpha = 0.72
  if (n < MANY) {
    for (let i = 0; i < n; i++) {
      const at = point(i)
      if (!at) continue
      painter.beginPath()
      painter.arc(at[0], at[1], r, 0, Math.PI * 2)
      painter.fill()
    }
  } else if (view.vector || !stampDots(painter, series.color, view, r, n, point)) {
    // no canvas to stamp on (an SVG, or not in a page): one shape, a dot per pixel
    const columns = Math.ceil(plot.width) + 17
    const cells = columns * (Math.ceil(plot.height) + 17)
    const seen = take(cells)
    painter.beginPath()
    for (let i = 0; i < n; i++) {
      const at = point(i)
      if (!at) continue
      const cell = Math.round(at[1] - plot.y + 8) * columns + Math.round(at[0] - plot.x + 8)
      if (seen[cell]) continue
      seen[cell] = 1
      painter.moveTo(at[0] + r, at[1])
      painter.arc(at[0], at[1], r, 0, Math.PI * 2)
    }
    painter.fill()
  }
  painter.restore()
}

let buffer = new Uint8Array(0)
/** A zeroed buffer of at least `length` bytes, reused between draws. */
function take(length: number): Uint8Array {
  if (buffer.length < length) buffer = new Uint8Array(length)
  else buffer.fill(0, 0, length)
  return buffer
}

/** How much of each pixel a dot of radius `radius` device px covers, around a center pixel. */
const masks = new Map<number, { half: number; size: number; cover: Uint8Array }>()
function dotMask(radius: number) {
  const key = Math.round(radius * 4) / 4
  let mask = masks.get(key)
  if (!mask) {
    const half = Math.ceil(key + 0.5)
    const size = half * 2 + 1
    const cover = new Uint8Array(size * size)
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const d = Math.hypot(x - half, y - half)
        cover[y * size + x] = Math.round(Math.min(1, Math.max(0, key + 0.5 - d)) * 255)
      }
    masks.set(key, (mask = { half, size, cover }))
  }
  return mask
}

let layer: HTMLCanvasElement | null = null

/**
 * Draws many dots by stamping them into one image: a dot is a small mask
 * of how much of each pixel it covers, the image keeps the most any dot
 * covers, and the result is drawn once in the series' color. It looks the
 * same as drawing every dot as a shape and is many times quicker. Returns
 * `false` when there is no canvas to stamp on.
 */
function stampDots(
  painter: Painter,
  color: string,
  { plot, dpr }: ChartView,
  r: number,
  n: number,
  point: (i: number) => [number, number] | null,
): boolean {
  if (typeof document === 'undefined') return false
  layer ??= document.createElement('canvas')
  const ctx = layer.getContext('2d')
  if (!ctx) return false
  const room = Math.ceil(r) + 8
  // on whole device pixels, so the image lands on the canvas unscaled
  const left = Math.floor((plot.x - room) * dpr) / dpr
  const top = Math.floor((plot.y - room) * dpr) / dpr
  const width = Math.ceil((plot.width + room * 2) * dpr)
  const height = Math.ceil((plot.height + room * 2) * dpr)
  const { half, size, cover } = dotMask(r * dpr)
  const alpha = take(width * height * 2)
  const centers = alpha.subarray(width * height)

  for (let i = 0; i < n; i++) {
    const at = point(i)
    if (!at) continue
    const cx = Math.round((at[0] - left) * dpr)
    const cy = Math.round((at[1] - top) * dpr)
    if (cx < 0 || cy < 0 || cx >= width || cy >= height) continue
    // a dot already stamped here: nothing to add
    const center = cy * width + cx
    if (centers[center]) continue
    centers[center] = 1
    const x0 = Math.max(0, half - cx)
    const x1 = Math.min(size, width - cx + half)
    const y0 = Math.max(0, half - cy)
    const y1 = Math.min(size, height - cy + half)
    for (let y = y0; y < y1; y++) {
      const row = (cy - half + y) * width + cx - half
      const maskRow = y * size
      for (let x = x0; x < x1; x++) {
        const c = cover[maskRow + x]!
        if (c > alpha[row + x]!) alpha[row + x] = c
      }
    }
  }

  if (layer.width !== width) layer.width = width
  if (layer.height !== height) layer.height = height
  const image = ctx.createImageData(width, height)
  const pixels = image.data
  for (let i = 0, j = 3; i < width * height; i++, j += 4) pixels[j] = alpha[i]!
  ctx.putImageData(image, 0, 0)
  // color what was stamped
  ctx.globalCompositeOperation = 'source-in'
  ctx.fillStyle = color
  ctx.fillRect(0, 0, width, height)
  ctx.globalCompositeOperation = 'source-over'
  painter.drawImage(layer, left, top, width / dpr, height / dpr)
  return true
}

/**
 * The point under `(px, py)`: the bubble it is inside (the smallest, which
 * is drawn on top), or the dot nearest to it within a finger's reach.
 */
export function hitScatter(
  series: ChartSeries<ScatterStyle>,
  view: ChartView,
  px: number,
  py: number,
): ChartHit | null {
  const point = pointOf(series, view)
  const n = Math.min(series.x.values.length, series.top.length)
  const sizeKey = series.props.size
  if (sizeKey === undefined) {
    const r = series.props.radius ?? DOT
    const reach = Math.max(r + 4, 12)
    if (n < MANY) {
      const hit = nearestPoint(n, point, px, py, () => reach)
      return hit && { index: hit.index, radius: r }
    }
    // many dots: only those in the cells around the pointer
    const { x: sx, y: sy, horizontal } = view
    const [along, across] = horizontal ? [py, px] : [px, py]
    let index = -1
    let distance = Infinity
    eachNear(
      pointGrid(series.x.values, series.top),
      sx.invert(along - reach),
      sx.invert(along + reach),
      sy.invert(across - reach),
      sy.invert(across + reach),
      (i) => {
        const at = point(i)
        if (!at) return
        const d = Math.hypot(at[0] - px, at[1] - py)
        // as with fewer dots: of equal ones, the one drawn last
        if (d <= reach && (d < distance || (d === distance && i > index))) {
          index = i
          distance = d
        }
      },
    )
    return index < 0 ? null : { index, radius: r }
  }
  const sizes = yColumn(series.rows, sizeKey)
  const radius = bubbleRadius(sizes, series.props.radius)
  let best: ChartHit | null = null
  for (let i = 0; i < n; i++) {
    const size = sizes[i]!
    if (!(size >= 0)) continue
    const at = point(i)
    if (!at) continue
    const r = radius(size)
    // small bubbles get a little more room, so they can be reached
    if (Math.hypot(at[0] - px, at[1] - py) > Math.max(r, 8)) continue
    if (!best || r < best.radius) best = { index: i, radius: r }
  }
  return best
}

export const scatterKind: ChartSeriesKind<ScatterStyle> = {
  type: 'scatter',
  tooltip: 'item',
  hit: hitScatter,
  // the grid for finding dots under the pointer, when there are many
  prepare: (series) => {
    const n = Math.min(series.x.values.length, series.top.length)
    if (n >= MANY && series.props.size === undefined) return pointGrid(series.x.values, series.top)
  },
  // bubbles may be large: keep them inside the plot
  inset: ({ props }) => (props.size === undefined ? 0 : (props.radius ?? BUBBLE) + 1),
  draw: drawScatter,
}
