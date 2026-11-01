import { turn } from '../core/geometry'
import type { FlowNode, Point } from '../core/model'
import type { WhiteboardInkData } from './model'

/** A sampled point: canvas position and pen pressure from 0 to 1. */
export interface InkPoint extends Point {
  pressure: number
}

export const INK_SIZE = 4

const round = (v: number) => Math.round(v * 10) / 10

/** The stroke's width at a pressure; a mouse, always 0.5, gets the plain size. */
const widthAt = (size: number, pressure: number) => size * (0.4 + 1.2 * pressure)

/**
 * Follows the pointer with a little lag, which smooths out the shake of a
 * hand; samples closer than `gap` to the last one are dropped.
 */
export function follow(points: InkPoint[], next: InkPoint, gap: number) {
  const last = points[points.length - 1]
  if (!last) return void points.push(next)
  const point = {
    x: last.x + (next.x - last.x) * 0.5,
    y: last.y + (next.y - last.y) * 0.5,
    pressure: last.pressure + (next.pressure - last.pressure) * 0.5,
  }
  if (Math.hypot(point.x - last.x, point.y - last.y) >= gap) points.push(point)
}

/** The node a finished stroke becomes: its box with room for the stroke's width. */
export function strokeNode(
  id: string,
  points: InkPoint[],
  size = INK_SIZE,
): FlowNode<WhiteboardInkData> {
  const pad = widthAt(size, 1) / 2 + 1
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of points) {
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }
  const x = minX - pad
  const y = minY - pad
  const width = round(maxX - minX + pad * 2)
  const height = round(maxY - minY + pad * 2)
  const flat: number[] = []
  for (const p of points) flat.push(round(p.x - x), round(p.y - y), round(p.pressure))
  return {
    id,
    type: 'ink',
    x: round(x),
    y: round(y),
    width,
    height,
    data: { points: flat, box: [width, height] },
  }
}

/**
 * A stroke's points in a box of `width` by `height`: the line itself
 * stretches, but the room left around it for the pen's width does not, so
 * a stretched stroke keeps its thickness.
 */
export function fitInk(
  points: readonly InkPoint[],
  box: readonly [number, number],
  width: number,
  height: number,
  size = INK_SIZE,
): InkPoint[] {
  const pad = widthAt(size, 1) / 2 + 1
  const axis = (from: number, to: number) => {
    const span = from - pad * 2
    // a flat stroke has no span to stretch: it stays centred
    return span > 0.01
      ? { scale: (to - pad * 2) / span, shift: 0 }
      : { scale: 1, shift: (to - from) / 2 }
  }
  const ax = axis(box[0], width)
  const ay = axis(box[1], height)
  if (ax.scale === 1 && ay.scale === 1 && !ax.shift && !ay.shift) return [...points]
  return points.map((p) => ({
    x: pad + (p.x - pad) * ax.scale + ax.shift,
    y: pad + (p.y - pad) * ay.scale + ay.shift,
    pressure: p.pressure,
  }))
}

/** The triples of `data.points` as points. */
export function unpack(flat: readonly number[]): InkPoint[] {
  const out: InkPoint[] = []
  for (let i = 0; i + 2 < flat.length; i += 3)
    out.push({ x: flat[i]!, y: flat[i + 1]!, pressure: flat[i + 2]! })
  return out
}

const fmt = (p: Point) => `${round(p.x)} ${round(p.y)}`

/**
 * The outline of a stroke as a filled path: each side offset by half the
 * width at that point, joined by round ends, with curves through the middles
 * of the samples.
 */
export function inkOutline(points: readonly InkPoint[], size = INK_SIZE): string {
  if (!points.length) return ''
  const first = points[0]!
  if (points.length === 1) {
    const r = widthAt(size, first.pressure) / 2
    return `M${round(first.x - r)} ${round(first.y)}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0Z`
  }
  const left: Point[] = []
  const right: Point[] = []
  for (let i = 0; i < points.length; i++) {
    const a = points[Math.max(0, i - 1)]!
    const b = points[Math.min(points.length - 1, i + 1)]!
    const p = points[i]!
    const length = Math.hypot(b.x - a.x, b.y - a.y) || 1
    // the normal to the direction through the neighbours
    const nx = -(b.y - a.y) / length
    const ny = (b.x - a.x) / length
    const r = widthAt(size, p.pressure) / 2
    left.push({ x: p.x + nx * r, y: p.y + ny * r })
    right.push({ x: p.x - nx * r, y: p.y - ny * r })
  }
  const side = (list: Point[]) => {
    let d = ''
    for (let i = 1; i < list.length - 1; i++) {
      const p = list[i]!
      const n = list[i + 1]!
      d += `Q${fmt(p)} ${fmt({ x: (p.x + n.x) / 2, y: (p.y + n.y) / 2 })}`
    }
    return d + `L${fmt(list[list.length - 1]!)}`
  }
  const last = points[points.length - 1]!
  const rEnd = round(widthAt(size, last.pressure) / 2)
  const rStart = round(widthAt(size, first.pressure) / 2)
  right.reverse()
  return (
    `M${fmt(left[0]!)}${side(left)}` +
    `A${rEnd} ${rEnd} 0 0 0 ${fmt(right[0]!)}${side(right)}` +
    `A${rStart} ${rStart} 0 0 0 ${fmt(left[0]!)}Z`
  )
}

function segmentDistance(p: Point, a: Point, b: Point) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const length = dx * dx + dy * dy
  const t = length ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length)) : 0
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy)
}

/** Whether a stroke passes within `radius` of a canvas point. */
export function inkHit(node: FlowNode, point: Point, radius: number): boolean {
  const data = node.data as WhiteboardInkData | undefined
  if (!data?.points?.length) return false
  const width = node.width ?? data.box[0]
  const height = node.height ?? data.box[1]
  // into the stroke's own units: undo the turn, then the stretch
  const centre = { x: node.x + width / 2, y: node.y + height / 2 }
  const local = turn(point, centre, -(data.rotation ?? 0))
  const size = data.size ?? INK_SIZE
  const points = fitInk(unpack(data.points), data.box, width, height, size).map((p) => ({
    x: node.x + p.x,
    y: node.y + p.y,
    pressure: p.pressure,
  }))
  const reach = radius + size / 2
  if (points.length === 1)
    return Math.hypot(local.x - points[0]!.x, local.y - points[0]!.y) <= reach
  for (let i = 1; i < points.length; i++)
    if (segmentDistance(local, points[i - 1]!, points[i]!) <= reach) return true
  return false
}
