import { barLabels, drawBars, type BarStyle } from './bar'
import { niceStep } from './scale'
import type { ChartSeriesKind, ChartView } from './series'

/*
 * A histogram: values counted into bins of equal width, and a bar for each
 * bin across all of it, so the bars stand side by side with only a
 * hairline between them. The bins' edges are round numbers.
 */

export interface HistogramBin {
  /** Where the bin starts, inclusive. */
  x0: number
  /** Where it ends: exclusive, but for the last bin. */
  x1: number
  /** Its middle, where the bar is placed. */
  x: number
  count: number
}

/**
 * Counts `values` into bins of width `step`, or of a round width giving
 * about `count` bins (by default, by the number of values: Sturges' rule).
 * Values that aren't numbers are left out.
 */
export function histogramBins(
  values: ArrayLike<number>,
  { count, step }: { count?: number; step?: number } = {},
): HistogramBin[] {
  let min = Infinity
  let max = -Infinity
  let n = 0
  for (let i = 0; i < values.length; i++) {
    const v = values[i]!
    if (!Number.isFinite(v)) continue
    n++
    if (v < min) min = v
    if (v > max) max = v
  }
  if (!n) return []
  const width =
    step && step > 0
      ? step
      : max > min
        ? niceStep(max - min, Math.max(1, count ?? Math.ceil(Math.log2(n)) + 1))
        : 1
  const start = Math.floor(min / width) * width
  // the largest value falls in the last bin, which includes its end
  const bins = Math.max(1, Math.ceil((max - start) / width - 1e-9))
  const out: HistogramBin[] = []
  for (let k = 0; k < bins; k++) {
    // round each edge, so 0.1 steps give 0.3, not 0.30000000000000004
    const x0 = round(start + k * width, width)
    const x1 = round(start + (k + 1) * width, width)
    out.push({ x0, x1, x: (x0 + x1) / 2, count: 0 })
  }
  for (let i = 0; i < values.length; i++) {
    const v = values[i]!
    if (!Number.isFinite(v)) continue
    const k = Math.min(bins - 1, Math.floor((v - start) / width + 1e-9))
    out[k]!.count++
  }
  return out
}

function round(value: number, step: number) {
  const digits = Math.max(0, -Math.floor(Math.log10(step)) + 1)
  return Number(value.toFixed(Math.min(20, digits)))
}

/** The bars across all of each bin, a hairline apart. */
const placement = (view: ChartView) => {
  const gap = view.band > 4 ? 1 : 0
  return { offset: -view.band / 2 + gap / 2, width: view.band - gap }
}

export const histogramKind: ChartSeriesKind<BarStyle> = {
  type: 'bar',
  zero: true,
  band: true,
  draw: (painter, series, view) => drawBars(painter, series, view, placement(view)),
  labels: (series, view) => barLabels(series, view, placement(view)),
  xTitle: (series, row, text) => {
    const bin = series.rows as unknown as HistogramBin[]
    const b = bin[row]
    return b ? `${text(b.x0)} – ${text(b.x1)}` : ''
  },
}
