import { toTime, type XKind } from './data'
import { numberTickFormat, timeTickFormat } from './format'
import type { ChartModel } from './model'
import type { Rect } from './painter'
import {
  bandScale,
  bandTicks,
  linearDomain,
  linearScale,
  linearTicks,
  logDomain,
  logScale,
  logTicks,
  nextNiceStep,
  niceStep,
  stepDecimals,
  type Scale,
} from './scale'
import type { ChartValueAxis } from './series'
import { timeInterval, timeTicks } from './time'

export type ChartAxisPosition = 'bottom' | 'left' | 'right'
export type ChartAxisType = 'linear' | 'log' | 'time' | 'band'

/** A tick value as `format` receives it: a number, a `Date` on time axes, the category on band axes. */
export type ChartTickValue = number | Date | string

/** An axis as configured, with defaults filled in. */
export interface AxisConfig {
  position: ChartAxisPosition
  type?: ChartAxisType
  min?: number | string | Date
  max?: number | string | Date
  zero?: boolean
  nice?: boolean
  ticks?: number | Array<number | string | Date>
  format?: (value: any) => string
  grid: boolean
  title?: string
  hidden: boolean
}

export interface TickLabel {
  text: string
  /** Where the label's box goes, in px from the chart's top left. */
  left: number
  top: number
  width: number
}

export interface AxisLayout {
  position: ChartAxisPosition
  scale: Scale
  /** Tick values, as numbers on the scale. */
  ticks: number[]
  labels: TickLabel[]
  grid: boolean
  title?: { text: string; left: number; top: number; align: 'start' | 'end' }
}

export interface ChartLayout {
  width: number
  height: number
  plot: Rect
  x: AxisLayout
  y: Partial<Record<ChartValueAxis, AxisLayout>>
}

/** Height of a line of tick text, and the room between it and the plot. */
export const LABEL_HEIGHT = 16
export const LABEL_GAP = 8
/** Room left around the plot so lines and dots at the edge aren't cut. */
export const EDGE = 8
/** Wanted room between ticks, in px. */
const X_TICK_SPACE = 64
const Y_TICK_SPACE = 48

interface LayoutOptions {
  model: ChartModel
  axes: Record<ChartAxisPosition, AxisConfig | null>
  width: number
  height: number
  locale: string
  measure: (text: string) => number
}

const asNumber = (value: number | string | Date | undefined, kind: XKind | 'log') =>
  value === undefined ? undefined : kind === 'time' ? toTime(value) : Number(value)

/** Places the axes and works out the plot area, the scales and the tick labels. */
export function layoutChart({
  model,
  axes,
  width,
  height,
  locale,
  measure,
}: LayoutOptions): ChartLayout {
  const xAxis = axes.bottom!
  const xShown = !xAxis.hidden
  const xType = model.xKind
  const titleRoom =
    (axes.left?.title && !axes.left.hidden) || (axes.right?.title && !axes.right.hidden)
  // a title sits above the top tick label, which is centered on the plot's top edge
  const top = titleRoom ? LABEL_HEIGHT + LABEL_GAP + LABEL_HEIGHT / 2 : EDGE
  const bottom = xShown ? LABEL_HEIGHT + LABEL_GAP + (xAxis.title ? LABEL_HEIGHT + 4 : 0) : EDGE
  const plotTop = top
  const plotBottom = Math.max(plotTop + 1, height - bottom)
  const plotHeight = plotBottom - plotTop

  // value axes first: their labels decide how wide the plot is
  const yCount = Math.max(2, Math.floor(plotHeight / Y_TICK_SPACE))
  const left = axes.left ? valueAxis('left', axes.left, model, yCount, locale) : null
  let right = axes.right ? valueAxis('right', axes.right, model, yCount, locale) : null
  // two axes share one set of grid lines: give the right one as many steps as the left
  if (left && right && !axes.right!.ticks && !right.fixed && left.ticks.length > 1)
    right = alignTo(right, left.ticks.length - 1, axes.right!, model, locale)

  const leftWidth = left && !axes.left!.hidden ? labelWidth(left.texts, measure) + LABEL_GAP : EDGE
  const rightWidth =
    right && !axes.right!.hidden ? labelWidth(right.texts, measure) + LABEL_GAP : EDGE
  const plot: Rect = {
    x: leftWidth,
    y: plotTop,
    width: Math.max(1, width - leftWidth - rightWidth),
    height: plotHeight,
  }

  const yLayout: ChartLayout['y'] = {}
  for (const axis of [left, right]) {
    if (!axis) continue
    const config = axes[axis.position]!
    const scale =
      axis.kind === 'log'
        ? logScale(axis.domain, [plot.y + plot.height, plot.y])
        : linearScale(axis.domain, [plot.y + plot.height, plot.y])
    const labels: TickLabel[] = config.hidden
      ? []
      : axis.ticks.map((value, i) => {
          const text = axis.texts[i]!
          const w = measure(text)
          return {
            text,
            width: w,
            left:
              axis.position === 'left' ? plot.x - LABEL_GAP - w : plot.x + plot.width + LABEL_GAP,
            top: clamp(scale.map(value) - LABEL_HEIGHT / 2, 0, height - LABEL_HEIGHT),
          }
        })
    yLayout[axis.position] = {
      position: axis.position,
      scale,
      ticks: axis.ticks,
      labels,
      grid: config.grid,
      title:
        config.title && !config.hidden
          ? {
              text: config.title,
              top: 0,
              left: axis.position === 'left' ? 0 : width,
              align: axis.position === 'left' ? 'start' : 'end',
            }
          : undefined,
    }
  }

  const x = categoryOrTimeAxis(xAxis, xType, model, plot, width, locale, measure)
  if (xAxis.title && xShown)
    x.title = { text: xAxis.title, top: height - LABEL_HEIGHT, left: width, align: 'end' }

  return { width, height, plot, x, y: yLayout }
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

function labelWidth(texts: string[], measure: (text: string) => number): number {
  let widest = 0
  for (const text of texts) widest = Math.max(widest, measure(text))
  return Math.ceil(widest)
}

interface ValueAxis {
  position: ChartValueAxis
  kind: 'linear' | 'log'
  domain: [number, number]
  ticks: number[]
  texts: string[]
  /** Whether both ends were given, so it can't be aligned to another axis. */
  fixed: boolean
}

function valueAxis(
  position: ChartValueAxis,
  config: AxisConfig,
  model: ChartModel,
  count: number,
  locale: string,
): ValueAxis {
  const kind = config.type === 'log' ? 'log' : 'linear'
  const data = model.y[position]
  const zero = config.zero ?? model.zero[position]
  let lo = data ? data[0] : 0
  let hi = data ? data[1] : 1
  if (zero && kind === 'linear') {
    lo = Math.min(lo, 0)
    hi = Math.max(hi, 0)
  }
  const min = asNumber(config.min, kind)
  const max = asNumber(config.max, kind)
  if (min !== undefined) lo = min
  if (max !== undefined) hi = max
  let domain: [number, number]
  if (kind === 'log') domain = min !== undefined && max !== undefined ? [lo, hi] : logDomain(lo, hi)
  else {
    domain = linearDomain(lo, hi, { count, nice: config.nice ?? true })
    if (min !== undefined) domain[0] = min
    if (max !== undefined) domain[1] = max
  }
  const ticks =
    explicitTicks(config, kind) ??
    (kind === 'log'
      ? logTicks(domain[0], domain[1], count)
      : linearTicks(domain[0], domain[1], count))
  return {
    position,
    kind,
    domain,
    ticks,
    texts: tickTexts(ticks, config, locale),
    fixed: min !== undefined && max !== undefined,
  }
}

/** Gives `axis` exactly `intervals` steps of a nice size, still covering its data. */
function alignTo(
  axis: ValueAxis,
  intervals: number,
  config: AxisConfig,
  model: ChartModel,
  locale: string,
): ValueAxis {
  if (axis.kind === 'log') return axis
  const data = model.y[axis.position]
  const zero = config.zero ?? model.zero[axis.position]
  let lo = data ? data[0] : 0
  let hi = data ? data[1] : 1
  if (zero) {
    lo = Math.min(lo, 0)
    hi = Math.max(hi, 0)
  }
  if (config.min !== undefined) lo = Number(config.min)
  if (lo === hi) hi = lo + 1
  let step = niceStep(hi - lo, intervals)
  for (let guard = 0; guard < 8; guard++) {
    const start = config.min !== undefined ? lo : Math.floor(lo / step) * step
    if (start + step * intervals >= hi - 1e-9) {
      const decimals = stepDecimals(step)
      const ticks = Array.from({ length: intervals + 1 }, (_, i) =>
        Number((start + step * i).toFixed(decimals)),
      )
      return {
        ...axis,
        domain: [ticks[0]!, ticks[intervals]!],
        ticks,
        texts: tickTexts(ticks, config, locale),
      }
    }
    step = nextNiceStep(step)
  }
  return axis
}

function explicitTicks(config: AxisConfig, kind: XKind | 'log'): number[] | null {
  if (!Array.isArray(config.ticks)) return null
  return config.ticks.map((value) => asNumber(value, kind)!).filter((v) => Number.isFinite(v))
}

function tickTexts(ticks: number[], config: AxisConfig, locale: string): string[] {
  if (config.format) return ticks.map((value) => config.format!(value))
  const format = numberTickFormat(locale, ticks)
  return ticks.map((value) => format(value))
}

function categoryOrTimeAxis(
  config: AxisConfig,
  kind: XKind,
  model: ChartModel,
  plot: Rect,
  width: number,
  locale: string,
  measure: (text: string) => number,
): AxisLayout {
  const range: [number, number] = [plot.x, plot.x + plot.width]
  const labelTop = plot.y + plot.height + LABEL_GAP
  const wanted = Math.max(2, Math.floor(plot.width / X_TICK_SPACE))

  const place = (
    scale: Scale,
    ticks: number[],
    text: (value: number, previous?: number) => string,
  ) => {
    const labels: TickLabel[] = ticks.map((value, i) => {
      const t = text(value, i > 0 ? ticks[i - 1] : undefined)
      const w = measure(t)
      return {
        text: t,
        width: w,
        left: clamp(scale.map(value) - w / 2, 0, width - w),
        top: labelTop,
      }
    })
    return labels
  }
  const fits = (labels: TickLabel[]) => {
    for (let i = 1; i < labels.length; i++)
      if (labels[i]!.left < labels[i - 1]!.left + labels[i - 1]!.width + LABEL_GAP) return false
    return true
  }
  const result = (scale: Scale, ticks: number[], labels: TickLabel[]): AxisLayout => ({
    position: 'bottom',
    scale,
    ticks,
    labels: config.hidden ? [] : labels,
    grid: config.grid,
  })
  if (kind === 'band') {
    const scale = bandScale(model.categories, range)
    const text = (value: number) =>
      config.format ? config.format(model.categories[value]) : (model.categories[value] ?? '')
    // every category when they fit, else every second, third…
    for (let every = 1; ; every++) {
      const ticks = bandTicks(model.categories.length, every)
      const labels = place(scale, ticks, text)
      if (fits(labels) || ticks.length <= 1) return result(scale, ticks, labels)
    }
  }

  const data = model.x ?? [0, 1]
  let lo = asNumber(config.min, kind) ?? data[0]
  let hi = asNumber(config.max, kind) ?? data[1]
  if (kind === 'time') {
    if (lo === hi) {
      lo -= 12 * 3600e3
      hi += 12 * 3600e3
    }
    const scale = linearScale([lo, hi], range, 'time')
    const explicit = explicitTicks(config, kind)
    for (let count = wanted; count >= 1; count--) {
      const interval = timeInterval(hi - lo, count)
      const ticks = explicit ?? timeTicks(lo, hi, interval)
      const format = timeTickFormat(locale, interval)
      const labels = place(scale, ticks, (value, previous) =>
        config.format ? config.format(new Date(value)) : format(value, previous),
      )
      if (explicit || fits(labels) || count === 1) return result(scale, ticks, labels)
    }
  }

  const domain = linearDomain(lo, hi, { count: wanted, nice: config.nice ?? false })
  if (config.min !== undefined) domain[0] = lo
  if (config.max !== undefined) domain[1] = hi
  const scale = linearScale(domain, range)
  const explicit = explicitTicks(config, kind)
  for (let count = wanted; count >= 1; count--) {
    const ticks = explicit ?? linearTicks(domain[0], domain[1], count)
    const format = numberTickFormat(locale, ticks)
    const labels = place(scale, ticks, (value) =>
      config.format ? config.format(value) : format(value),
    )
    if (explicit || fits(labels) || count === 1) return result(scale, ticks, labels)
  }
  return result(scale, [], [])
}
