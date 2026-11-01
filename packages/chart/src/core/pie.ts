import { read, yColumn, type ChartAccessor, type ChartData, rowOf } from './data'
import type { Painter } from './painter'
import { fillPattern, type ChartPattern } from './pattern'

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
  /**
   * How much of its ring it fills, 0 to 1: 1, but for a rose, whose
   * slices share the turn evenly and fill out by their values.
   */
  reach: number
}

/**
 * How far out a slice reaches, from a hole of `inner` px to `radius` px:
 * a rose's slice by area, so twice the value covers twice the ink.
 */
export function sliceOuter(slice: Pick<PieSlice, 'reach'>, inner: number, radius: number) {
  if (slice.reach >= 1) return radius
  return Math.sqrt(inner * inner + (radius * radius - inner * inner) * slice.reach)
}

/** The part of the turn a pie takes, and whether it is a rose. */
export interface PieShape {
  /** Where the slices start and end, in radians clockwise from 12 o'clock. */
  start?: number
  end?: number
  /** Each slice the same angle, its area (not its angle) by its value. */
  rose?: boolean
}

/**
 * The slices of `rows`: one per row with a value above 0, in the order
 * given, going round clockwise from the top. Slices named in `hidden`
 * are kept, with no room, so they keep their place and color.
 */
export function pieSlices(
  rows: ChartData,
  value: ChartAccessor,
  label: ChartAccessor | undefined,
  color?: ChartAccessor,
  hidden?: readonly string[],
  shape: PieShape = {},
): PieSlice[] {
  const values = yColumn(rows, value)
  const off = new Set(hidden)
  const slices: PieSlice[] = []
  let total = 0
  for (let i = 0; i < values.length; i++) {
    const v = values[i]!
    if (!(v > 0)) continue
    const text = label === undefined ? undefined : read(rowOf(rows, i), label, i)
    const own = color === undefined ? undefined : read(rowOf(rows, i), color, i)
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
      reach: 1,
    }
    if (!slice.hidden) total += v
    slices.push(slice)
  }
  const from = shape.start ?? 0
  const span = Math.max(0, Math.min(Math.PI * 2, (shape.end ?? from + Math.PI * 2) - from))
  const shown = slices.filter((slice) => !slice.hidden)
  // a rose: the largest reaches the rim, the others by area, so the eye compares amounts
  const most = Math.max(0, ...shown.map((slice) => slice.value))
  let angle = from
  for (const slice of slices) {
    slice.start = angle
    if (!slice.hidden && total > 0) {
      slice.share = slice.value / total
      angle += shape.rose ? span / shown.length : slice.share * span
      if (shape.rose) slice.reach = slice.value / most
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
    from = 0,
    patterns,
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
    /** Where the slices start: coming in, they sweep round from there. */
    from?: number
    /** The pattern over each slice, by its `index`. */
    patterns?: Array<ChartPattern | null>
  },
) {
  const turn = (angle: number) => from + (angle - from) * sweep
  const shown = slices.filter((slice) => slice.end > slice.start)
  slices.forEach((slice, k) => {
    if (!(slice.end > slice.start)) return
    painter.save()
    painter.fillStyle = colors[k]!
    if (focus >= 0 && slice.index !== focus) painter.globalAlpha = fade
    painter.beginPath()
    // a rose's slice reaches out by its value, from the hole's edge
    const outer = sliceOuter(slice, inner, radius)
    painter.arc(cx, cy, outer, at(turn(slice.start)), at(turn(slice.end)))
    if (inner > 0) painter.arc(cx, cy, inner, at(turn(slice.end)), at(turn(slice.start)), true)
    else painter.lineTo(cx, cy)
    painter.closePath()
    painter.fill()
    const pattern = patterns?.[slice.index]
    if (pattern) {
      const box = { x: cx - radius, y: cy - radius, width: radius * 2, height: radius * 2 }
      fillPattern(painter, pattern, box, surface)
    }
    painter.restore()
  })
  if (shown.length < 2) return
  // the gaps: lines of surface color along each edge, the same width all the way out
  painter.save()
  painter.strokeStyle = surface
  painter.lineWidth = GAP
  painter.lineCap = 'butt'
  painter.beginPath()
  // round the whole circle, the first slice meets the last
  const last = shown[shown.length - 1]!
  const whole = Math.abs(last.end - shown[0]!.start - Math.PI * 2) < 1e-6
  shown.forEach((slice, k) => {
    const a = at(turn(slice.start))
    const cos = Math.cos(a)
    const sin = Math.sin(a)
    // out to the longer of the two slices the edge is between (a rose's differ)
    const before = k > 0 ? shown[k - 1] : whole ? last : undefined
    const end = sliceOuter({ reach: Math.max(slice.reach, before?.reach ?? 0) }, inner, radius) + 1
    painter.moveTo(cx + cos * inner, cy + sin * inner)
    painter.lineTo(cx + cos * end, cy + sin * end)
  })
  painter.stroke()
  painter.restore()
}
