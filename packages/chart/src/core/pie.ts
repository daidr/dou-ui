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
  /** Its part of the whole, 0 to 1; 0 when hidden. */
  share: number
  /** Turned off in the legend: it keeps its color, but takes no room. */
  hidden: boolean
  start: number
  end: number
}

/**
 * The slices of `rows`: one per row with a value above 0, in the order
 * given, going round clockwise from the top. Slices named in `hidden`
 * are kept, with no room, so they keep their place and color.
 */
export function pieSlices(
  rows: readonly ChartRow[],
  value: ChartAccessor,
  label: ChartAccessor | undefined,
  color?: ChartAccessor,
  hidden?: readonly string[],
): PieSlice[] {
  const values = yColumn(rows, value)
  const off = new Set(hidden)
  const slices: PieSlice[] = []
  let total = 0
  for (let i = 0; i < values.length; i++) {
    const v = values[i]!
    if (!(v > 0)) continue
    const text = label === undefined ? undefined : read(rows[i], label, i)
    const own = color === undefined ? undefined : read(rows[i], color, i)
    const name = text == null ? `${i + 1}` : String(text)
    const slice = {
      index: i,
      label: name,
      color: own == null || own === '' ? undefined : String(own),
      value: v,
      share: 0,
      hidden: off.has(name),
      start: 0,
      end: 0,
    }
    if (!slice.hidden) total += v
    slices.push(slice)
  }
  let angle = 0
  for (const slice of slices) {
    slice.start = angle
    if (!slice.hidden && total > 0) {
      slice.share = slice.value / total
      angle += slice.share * Math.PI * 2
    }
    slice.end = angle
  }
  return slices
}

/** Angles are from 12 o'clock; the canvas counts from 3 o'clock. */
const at = (angle: number) => angle - Math.PI / 2

/** How much of a series or slice shows while another is brought forward. */
export const FADED = 0.24

/** Room between slices, in px. */
const GAP = 2

/**
 * Draws the slices around `cx, cy`, from `inner` (0 for a pie) to
 * `radius`, with a gap of the chart's surface color between them. With
 * `focus`, the other slices are faded; `sweep` (0 to 1) draws only that
 * much of the way round, for the pie to come in.
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
    focus = -1,
    fade = FADED,
    sweep = 1,
  }: {
    cx: number
    cy: number
    radius: number
    inner: number
    surface: string
    /** The `index` of the slice to bring forward. */
    focus?: number
    /** How much the other slices show. */
    fade?: number
    sweep?: number
  },
) {
  const turn = (angle: number) => angle * sweep
  const shown = slices.filter((slice) => slice.end > slice.start)
  slices.forEach((slice, k) => {
    if (!(slice.end > slice.start)) return
    painter.save()
    painter.fillStyle = colors[k]!
    if (focus >= 0 && slice.index !== focus) painter.globalAlpha = fade
    painter.beginPath()
    painter.arc(cx, cy, radius, at(turn(slice.start)), at(turn(slice.end)))
    if (inner > 0) painter.arc(cx, cy, inner, at(turn(slice.end)), at(turn(slice.start)), true)
    else painter.lineTo(cx, cy)
    painter.closePath()
    painter.fill()
    painter.restore()
  })
  if (shown.length < 2) return
  // the gaps: lines of surface color along each edge, the same width all the way out
  painter.save()
  painter.strokeStyle = surface
  painter.lineWidth = GAP
  painter.lineCap = 'butt'
  painter.beginPath()
  for (const slice of shown) {
    const a = at(turn(slice.start))
    const cos = Math.cos(a)
    const sin = Math.sin(a)
    painter.moveTo(cx + cos * inner, cy + sin * inner)
    painter.lineTo(cx + cos * (radius + 1), cy + sin * (radius + 1))
  }
  painter.stroke()
  painter.restore()
}
