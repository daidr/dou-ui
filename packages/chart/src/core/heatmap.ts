import { extent } from './data'
import type { Painter } from './painter'
import type { ChartHit, ChartLabelAnchor, ChartSeries, ChartSeriesKind, ChartView } from './series'

/*
 * A heatmap: a cell for each row, at its x and the category its `y`
 * names, colored by its value along a sequential scale from the chart's
 * surface to the series' color. Lighter is less, darker (or stronger) is
 * more, in steps the eye reads as even.
 */

export interface HeatmapStyle {
  /** The value the scale starts at; by default the smallest. */
  min?: number
  /** The value the scale ends at; by default the largest. */
  max?: number
}

/** The room between cells, in px: the surface shows through as a grid. */
const GAP = 1
/** Corner radius of a cell, in px. */
const RADIUS = 2
/** How much of the color the smallest value takes, so it still shows on the surface. */
const LEAST = 0.06

/** The values a heatmap's scale runs between: `min` and `max` as given, else the data's ends. */
export function heatRange(
  series: Pick<ChartSeries<HeatmapStyle>, 'props' | 'y'>,
): [number, number] | null {
  const { min, max } = series.props
  const data = extent(series.y)
  const lo = Number.isFinite(min) ? min! : data?.[0]
  const hi = Number.isFinite(max) ? max! : data?.[1]
  if (lo === undefined || hi === undefined) return null
  return hi > lo ? [lo, hi] : data
}

/** Where `value` falls on the scale, 0 to 1. */
export function heatShare(value: number, range: [number, number]): number {
  const [lo, hi] = range
  if (!(hi > lo)) return 1
  return Math.min(1, Math.max(0, (value - lo) / (hi - lo)))
}

type Lab = [number, number, number]

/** An `rgb()` / `rgba()` / `#rrggbb` color as OKLab, or `null`. */
function toLab(color: string): Lab | null {
  let rgb: number[] | null = null
  const m = /rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(color)
  if (m) rgb = [Number(m[1]), Number(m[2]), Number(m[3])]
  else {
    const hex = /^#([\da-f]{6})$/i.exec(color)
    if (hex) {
      const n = Number.parseInt(hex[1]!, 16)
      rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
    }
  }
  if (!rgb) return null
  const [r, g, b] = rgb.map((c) => {
    const v = c / 255
    return v <= 0.040_45 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  const l = Math.cbrt(0.412_221_470_8 * r + 0.536_332_536_3 * g + 0.051_445_992_9 * b)
  const mm = Math.cbrt(0.211_903_498_2 * r + 0.680_699_545_1 * g + 0.107_396_956_6 * b)
  const s = Math.cbrt(0.088_302_461_9 * r + 0.281_718_837_6 * g + 0.629_978_700_5 * b)
  return [
    0.210_454_255_3 * l + 0.793_617_785 * mm - 0.004_072_046_8 * s,
    1.977_998_495_1 * l - 2.428_592_205 * mm + 0.450_593_709_9 * s,
    0.025_904_037_1 * l + 0.782_771_766_2 * mm - 0.808_675_766 * s,
  ]
}

function fromLab([L, A, B]: Lab): string {
  const l = (L + 0.396_337_777_4 * A + 0.215_803_757_3 * B) ** 3
  const m = (L - 0.105_561_345_8 * A - 0.063_854_172_8 * B) ** 3
  const s = (L - 0.089_484_177_5 * A - 1.291_485_548 * B) ** 3
  const linear = [
    4.076_741_662_1 * l - 3.307_711_591_3 * m + 0.230_969_929_2 * s,
    -1.268_438_004_6 * l + 2.609_757_401_1 * m - 0.341_319_396_5 * s,
    -0.004_196_086_3 * l - 0.703_418_614_7 * m + 1.707_614_701 * s,
  ]
  const [r, g, b] = linear.map((v) => {
    const c = v <= 0.003_130_8 ? 12.92 * v : 1.055 * Math.max(0, v) ** (1 / 2.4) - 0.055
    return Math.round(Math.min(1, Math.max(0, c)) * 255)
  })
  return `rgb(${r}, ${g}, ${b})`
}

/**
 * The color at `share` (0 to 1) of a scale from `surface` to `color`,
 * mixed in OKLab so equal steps look equal; the smallest still shows.
 */
export function heatColor(color: string, surface: string, share: number): string {
  const to = toLab(color)
  const from = toLab(surface)
  if (!to || !from) return color
  const t = LEAST + (1 - LEAST) * share
  return fromLab([
    from[0] + (to[0] - from[0]) * t,
    from[1] + (to[1] - from[1]) * t,
    from[2] + (to[2] - from[2]) * t,
  ])
}

/** A cell's box: its center and size in px, whichever way the chart runs. */
function cellOf(series: ChartSeries<HeatmapStyle>, view: ChartView, i: number) {
  const x = series.x.values[i]!
  const y = series.top[i]!
  if (x !== x || y !== y || series.y[i] !== series.y[i]) return null
  const [cx, cy] = view.point(x, y)
  const across = view.band
  const down = Math.abs(view.y.map(0) - view.y.map(1))
  const [width, height] = view.horizontal ? [down, across] : [across, down]
  return { x: cx - width / 2, y: cy - height / 2, width, height, cx, cy }
}

/** The colors of a series' cells, by row, worked out once per draw. */
function cellColors(series: ChartSeries<HeatmapStyle>, view: ChartView): string[] {
  const range = heatRange(series)
  const out: string[] = Array.from({ length: series.y.length })
  if (!range) return out
  // a handful of colors are used over and over: one per step of the scale
  const steps = new Map<number, string>()
  for (let i = 0; i < series.y.length; i++) {
    const v = series.y[i]!
    if (v !== v) continue
    const step = Math.round(heatShare(v, range) * 255)
    let c = steps.get(step)
    if (!c) steps.set(step, (c = heatColor(series.color, view.colors.surface, step / 255)))
    out[i] = c
  }
  return out
}

export const heatmapKind: ChartSeriesKind<HeatmapStyle> = {
  type: 'heatmap',
  categoryY: true,
  band: true,
  tooltip: 'item',
  draw(painter: Painter, series, view) {
    const colors = cellColors(series, view)
    const { plot } = view
    for (let i = 0; i < series.y.length; i++) {
      const cell = cellOf(series, view, i)
      const color = colors[i]
      if (!cell || !color) continue
      if (cell.x + cell.width < plot.x || cell.x > plot.x + plot.width) continue
      const w = Math.max(0, cell.width - GAP)
      const h = Math.max(0, cell.height - GAP)
      const r = Math.min(RADIUS, w / 4, h / 4)
      painter.fillStyle = color
      painter.beginPath()
      roundRect(painter, cell.x + GAP / 2, cell.y + GAP / 2, w, h, r)
      painter.fill()
    }
  },
  hit(series, view, px, py): ChartHit | null {
    for (let i = 0; i < series.y.length; i++) {
      const cell = cellOf(series, view, i)
      if (!cell) continue
      if (px >= cell.x && px < cell.x + cell.width && py >= cell.y && py < cell.y + cell.height)
        return { index: i, radius: 0 }
    }
    return null
  },
  labels(series, view): ChartLabelAnchor[] {
    const colors = cellColors(series, view)
    const out: ChartLabelAnchor[] = []
    for (let i = 0; i < series.y.length; i++) {
      const cell = cellOf(series, view, i)
      const color = colors[i]
      if (!cell || !color) continue
      out.push({
        index: i,
        at: [cell.cx, cell.cy],
        side: 'center',
        box: { x: cell.x, y: cell.y, width: cell.width - GAP, height: cell.height - GAP, color },
      })
    }
    return out
  },
}

function roundRect(p: Painter, x: number, y: number, w: number, h: number, r: number) {
  p.moveTo(x + r, y)
  p.arcTo(x + w, y, x + w, y + h, r)
  p.arcTo(x + w, y + h, x, y + h, r)
  p.arcTo(x, y + h, x, y, r)
  p.arcTo(x, y, x + w, y, r)
  p.closePath()
}
