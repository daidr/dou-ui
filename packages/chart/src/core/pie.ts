import { read, yColumn, type ChartAccessor, type ChartRow } from './data'
import type { Painter } from './painter'

/** A slice of a pie, with its angles in radians clockwise from 12 o'clock. */
export interface PieSlice {
  /** The row's index. */
  index: number
  label: string
  value: number
  /** Its own color, if the pie reads one. */
  color?: string
  /** Its part of the whole, 0 to 1. */
  share: number
  start: number
  end: number
}

/**
 * The slices of `rows`: one per row with a value above 0, in the order
 * given, going round clockwise from the top.
 */
export function pieSlices(
  rows: readonly ChartRow[],
  value: ChartAccessor,
  label: ChartAccessor | undefined,
  color?: ChartAccessor,
): PieSlice[] {
  const values = yColumn(rows, value)
  let total = 0
  for (let i = 0; i < values.length; i++) if (values[i]! > 0) total += values[i]!
  if (!(total > 0)) return []
  const slices: PieSlice[] = []
  let angle = 0
  for (let i = 0; i < values.length; i++) {
    const v = values[i]!
    if (!(v > 0)) continue
    const share = v / total
    const end = angle + share * Math.PI * 2
    const text = label === undefined ? undefined : read(rows[i], label, i)
    const own = color === undefined ? undefined : read(rows[i], color, i)
    slices.push({
      index: i,
      label: text == null ? `${i + 1}` : String(text),
      color: own == null || own === '' ? undefined : String(own),
      value: v,
      share,
      start: angle,
      end,
    })
    angle = end
  }
  return slices
}

/** Angles are from 12 o'clock; the canvas counts from 3 o'clock. */
const at = (angle: number) => angle - Math.PI / 2

/** Room between slices, in px. */
const GAP = 2

/**
 * Draws the slices around `cx, cy`, from `inner` (0 for a pie) to
 * `radius`, with a gap of the chart's surface color between them.
 */
export function drawPie(
  painter: Painter,
  slices: PieSlice[],
  colors: string[],
  {
    cx,
    cy,
    radius,
    inner,
    surface,
  }: {
    cx: number
    cy: number
    radius: number
    inner: number
    surface: string
  },
) {
  slices.forEach((slice, k) => {
    painter.save()
    painter.fillStyle = colors[k]!
    painter.beginPath()
    painter.arc(cx, cy, radius, at(slice.start), at(slice.end))
    if (inner > 0) painter.arc(cx, cy, inner, at(slice.end), at(slice.start), true)
    else painter.lineTo(cx, cy)
    painter.closePath()
    painter.fill()
    painter.restore()
  })
  if (slices.length < 2) return
  // the gaps: lines of surface color along each edge, the same width all the way out
  painter.save()
  painter.strokeStyle = surface
  painter.lineWidth = GAP
  painter.lineCap = 'butt'
  painter.beginPath()
  for (const slice of slices) {
    const a = at(slice.start)
    const cos = Math.cos(a)
    const sin = Math.sin(a)
    painter.moveTo(cx + cos * inner, cy + sin * inner)
    painter.lineTo(cx + cos * (radius + 1), cy + sin * (radius + 1))
  }
  painter.stroke()
  painter.restore()
}
