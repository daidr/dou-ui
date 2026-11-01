import type { Painter } from './painter'
import type { ChartSeries, ChartSeriesKind, ChartView } from './series'

/*
 * A funnel: a bar for each stage, centered and one under another in the
 * order given, as wide as its value against the largest; between two
 * stages, a lighter band from one's width to the next shows what was lost.
 */

export interface FunnelStyle {
  /** Corner radius of the bars, in px. */
  radius?: number
}

/** How much of a stage's row its bar takes; the rest is the band to the next. */
export const FUNNEL_BAR = 0.7

/** A stage's bar: its left, top, width and height, in px; `null` without a value. */
export function stageBar(series: ChartSeries<FunnelStyle>, view: ChartView, i: number) {
  const x = series.x.values[i]!
  const v = series.top[i]!
  if (x !== x || v !== v) return null
  const [right, middle] = view.point(x, Math.max(0, v))
  const cx = view.plot.x + view.plot.width / 2
  const half = Math.max(right - cx, 0.5)
  return { x: cx - half, y: middle - view.band / 2, width: half * 2, height: view.band }
}

/** The rows of a funnel in stage order, with a value. */
function stages(series: ChartSeries<FunnelStyle>): number[] {
  const order: number[] = []
  for (let i = 0; i < series.top.length; i++)
    if (series.x.values[i] === series.x.values[i] && series.top[i] === series.top[i]) order.push(i)
  order.sort((a, b) => series.x.values[a]! - series.x.values[b]!)
  return order
}

export const funnelKind: ChartSeriesKind<FunnelStyle> = {
  type: 'funnel',
  funnel: true,
  zero: true,
  draw(painter: Painter, series, view) {
    const order = stages(series)
    const bars = order.map((i) => stageBar(series, view, i)!)
    // the bands between stages, under the bars
    painter.save()
    painter.fillStyle = series.color
    painter.globalAlpha *= 0.14
    painter.beginPath()
    for (let k = 0; k + 1 < bars.length; k++) {
      const a = bars[k]!
      const b = bars[k + 1]!
      // only between stages next to each other
      if (series.x.values[order[k + 1]!]! - series.x.values[order[k]!]! !== 1) continue
      painter.moveTo(a.x, a.y + a.height)
      painter.lineTo(a.x + a.width, a.y + a.height)
      painter.lineTo(b.x + b.width, b.y)
      painter.lineTo(b.x, b.y)
      painter.closePath()
    }
    painter.fill()
    painter.restore()
    const radius = Math.max(0, series.props.radius ?? 3)
    painter.save()
    painter.fillStyle = series.color
    painter.beginPath()
    for (const bar of bars) {
      const r = Math.min(radius, bar.width / 2, bar.height / 2)
      painter.moveTo(bar.x + r, bar.y)
      painter.arcTo(bar.x + bar.width, bar.y, bar.x + bar.width, bar.y + bar.height, r)
      painter.arcTo(bar.x + bar.width, bar.y + bar.height, bar.x, bar.y + bar.height, r)
      painter.arcTo(bar.x, bar.y + bar.height, bar.x, bar.y, r)
      painter.arcTo(bar.x, bar.y, bar.x + bar.width, bar.y, r)
      painter.closePath()
    }
    painter.fill()
    painter.restore()
  },
}
