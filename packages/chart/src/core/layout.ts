import { toTime, type XKind } from './data'
import { numberTickFormat, timeTickFormat } from './format'
import type { ChartModel } from './model'
import type { Rect } from './painter'
import {
  categoryScale,
  categoryTicks,
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
export type ChartAxisType = 'linear' | 'log' | 'time' | 'category'

/** A tick value as `format` receives it: a number, a `Date` on time axes, the category on category axes. */
export type ChartTickValue = number | Date | string

/** An axis as configured, with defaults filled in. `position` is where it is drawn. */
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

/** The axes by what they measure: `x`, and the value axes `left` and `right`. */
export interface ChartAxes {
  x: AxisConfig
  left: AxisConfig | null
  right: AxisConfig | null
}

export interface TickLabel {
  text: string
  /** Where the label's box goes, in px from the chart's top left. */
  left: number
  top: number
  width: number
}

export interface AxisLayout {
  /** Where the axis is drawn. */
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
  /** The value axes, by what they measure (with `horizontal`, `left` is drawn at the bottom). */
  y: Partial<Record<ChartValueAxis, AxisLayout>>
  legend: LegendItem[]
}

/** A legend entry, placed. */
export interface LegendItem {
  /** The entry's position in the names given. */
  index: number
  text: string
  left: number
  top: number
  width: number
}

/** Height of a line of tick text, and the room between it and the plot. */
export const LABEL_HEIGHT = 16
export const LABEL_GAP = 8
/** Room left around the plot so lines and dots at the edge aren't cut. */
export const EDGE = 8
/** Room between text and the chart's sides. */
export const INSET = 4
/** A legend entry: the swatch, the room after it, and the room to the next entry. */
const SWATCH = 12
const SWATCH_GAP = 6
const LEGEND_GAP = 16
const LEGEND_ROW_GAP = 4
/** Wanted room between ticks, in px. */
const X_TICK_SPACE = 64
const Y_TICK_SPACE = 48
/** Room between labels stacked down an axis. */
const ROW_GAP = 4

interface LayoutOptions {
  model: ChartModel
  axes: ChartAxes
  /** x runs down the left side and values along the bottom. */
  horizontal?: boolean
  width: number
  height: number
  locale: string
  measure: (text: string) => number
  /** Names for a legend under the chart, or none. */
  legend?: string[]
}

const asNumber = (value: number | string | Date | undefined, kind: XKind | 'log') =>
  value === undefined ? undefined : kind === 'time' ? toTime(value) : Number(value)

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/** Widens `[lo, hi]` so `inset` px stay free at both ends of an axis `length` px long. */
function widen(lo: number, hi: number, inset: number, length: number): [number, number] {
  if (!(inset > 0) || !(hi > lo)) return [lo, hi]
  const pad = ((hi - lo) * inset) / Math.max(1, length - inset * 2)
  return [lo - pad, hi + pad]
}

/** Places the axes and works out the plot area, the scales and the tick labels. */
export function layoutChart(options: LayoutOptions): ChartLayout {
  const { width, height, measure } = options
  const legend = placeLegend(options.legend ?? [], width, measure)
  const legendHeight = legendRoom(legend)
  for (const item of legend) item.top += height - legendHeight + LABEL_GAP + 4
  const layout = options.horizontal
    ? layoutAcross(options, legendHeight)
    : layoutUp(options, legendHeight)
  return { ...layout, legend }
}

/** The height a legend takes under the chart, with the gap above it. */
function legendRoom(legend: LegendItem[]): number {
  return legend.length ? LABEL_GAP + 4 + legend[legend.length - 1]!.top + LABEL_HEIGHT : 0
}

/** x along the bottom, values up the sides. */
function layoutUp(
  { model, axes, width, height, locale, measure }: LayoutOptions,
  legendHeight: number,
): Omit<ChartLayout, 'legend'> {
  const xAxis = axes.x
  const xShown = !xAxis.hidden
  const titleRoom =
    (axes.left?.title && !axes.left.hidden) || (axes.right?.title && !axes.right.hidden)
  // a title sits above the top tick label, which is centered on the plot's top edge
  const top = titleRoom ? LABEL_HEIGHT + LABEL_GAP + LABEL_HEIGHT / 2 : EDGE
  const bottom =
    (xShown ? LABEL_HEIGHT + LABEL_GAP + (xAxis.title ? LABEL_HEIGHT + 4 : 0) : EDGE) + legendHeight
  const plotTop = top
  const plotBottom = Math.max(plotTop + 1, height - bottom)
  const plotHeight = plotBottom - plotTop

  // value axes first: their labels decide how wide the plot is
  const yCount = Math.max(2, Math.floor(plotHeight / Y_TICK_SPACE))
  const left = axes.left ? valueAxis('left', axes.left, model, yCount, locale, plotHeight) : null
  let right = axes.right ? valueAxis('right', axes.right, model, yCount, locale, plotHeight) : null
  // two axes share one set of grid lines: give the right one as many steps as the left
  if (left && right && !axes.right!.ticks && !right.fixed && left.ticks.length > 1)
    right = alignTo(right, left.ticks.length - 1, axes.right!, model, locale, plotHeight)

  const leftWidth =
    left && !axes.left!.hidden ? INSET + labelWidth(left.texts, measure) + LABEL_GAP : EDGE
  const rightWidth =
    right && !axes.right!.hidden ? INSET + labelWidth(right.texts, measure) + LABEL_GAP : EDGE
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
    const scale = valueScale(axis, [plot.y + plot.height, plot.y])
    yLayout[axis.position] = {
      position: config.position,
      scale,
      ticks: axis.ticks,
      labels: config.hidden ? [] : placeDown(axis.ticks, axis.texts, scale, height, measure),
      grid: config.grid,
      title: sideTitle(config, width),
    }
    if (axis.position === 'left') for (const label of yLayout.left!.labels) alignEnd(label, plot.x)
    else for (const label of yLayout.right!.labels) label.left = plot.x + plot.width + LABEL_GAP
  }

  const along: [number, number] = [plot.x, plot.x + plot.width]
  const scale = xScale(xAxis, model, along, Math.max(2, Math.floor(plot.width / X_TICK_SPACE)))
  const labelTop = plot.y + plot.height + LABEL_GAP
  let x: AxisLayout | undefined
  for (const { ticks, texts } of xTickChoices(
    xAxis,
    model,
    scale,
    plot.width,
    X_TICK_SPACE,
    locale,
  )) {
    const labels = placeAcross(ticks, texts, scale, labelTop, width, measure)
    x = { position: xAxis.position, scale, ticks, labels, grid: xAxis.grid }
    if (fitAcross(labels)) break
  }
  x ??= { position: xAxis.position, scale, ticks: [], labels: [], grid: xAxis.grid }
  if (!xShown) x.labels = []
  else if (xAxis.title) x.title = bottomTitle(xAxis.title, width, height, legendHeight)

  return { width, height, plot, x, y: yLayout }
}

/** x down the left side, values along the bottom: bars with long category names. */
function layoutAcross(
  { model, axes, width, height, locale, measure }: LayoutOptions,
  legendHeight: number,
): Omit<ChartLayout, 'legend'> {
  const xAxis = axes.x
  const values = axes.left!
  const xShown = !xAxis.hidden
  const valuesShown = !values.hidden
  const top = xShown && xAxis.title ? LABEL_HEIGHT + LABEL_GAP : EDGE
  const bottom =
    (valuesShown ? LABEL_HEIGHT + LABEL_GAP + (values.title ? LABEL_HEIGHT + 4 : 0) : EDGE) +
    legendHeight
  const plotTop = top
  const plotBottom = Math.max(plotTop + 1, height - bottom)
  const plotHeight = plotBottom - plotTop

  // x first: its labels decide how far in the plot starts
  const down: [number, number] = [plotTop, plotBottom]
  const scale = xScale(xAxis, model, down, Math.max(2, Math.floor(plotHeight / Y_TICK_SPACE)))
  let x: AxisLayout | undefined
  for (const { ticks, texts } of xTickChoices(
    xAxis,
    model,
    scale,
    plotHeight,
    Y_TICK_SPACE,
    locale,
  )) {
    const labels = placeDown(ticks, texts, scale, height, measure)
    x = { position: xAxis.position, scale, ticks, labels, grid: xAxis.grid }
    if (fitDown(labels)) break
  }
  x ??= { position: xAxis.position, scale, ticks: [], labels: [], grid: xAxis.grid }
  if (!xShown) x.labels = []
  const leftWidth = xShown
    ? INSET +
      labelWidth(
        x.labels.map((l) => l.text),
        measure,
      ) +
      LABEL_GAP
    : EDGE

  let rightWidth = EDGE
  const plot: Rect = { x: leftWidth, y: plotTop, width: 1, height: plotHeight }
  const labelTop = plotBottom + LABEL_GAP
  const placeValues = (axis: ValueAxis) => {
    plot.width = Math.max(1, width - leftWidth - rightWidth)
    const valueScaleAcross = valueScale(axis, [plot.x, plot.x + plot.width])
    const labels = valuesShown
      ? placeAcross(axis.ticks, axis.texts, valueScaleAcross, labelTop, width, measure)
      : []
    return { scale: valueScaleAcross, labels }
  }
  const across = width - leftWidth - EDGE
  let axis = valueAxis('left', values, model, 2, locale, across)
  let placed = placeValues(axis)
  for (
    let count = Math.max(2, Math.floor((width - leftWidth) / X_TICK_SPACE));
    count >= 2;
    count--
  ) {
    axis = valueAxis('left', values, model, count, locale, across)
    placed = placeValues(axis)
    if (fitAcross(placed.labels)) break
  }
  // the last label is centered on the plot's right edge: leave it room
  const last = placed.labels[placed.labels.length - 1]
  if (last) {
    const excess =
      placed.scale.map(axis.ticks[axis.ticks.length - 1]!) + last.width / 2 + INSET - width
    if (excess > 0) {
      rightWidth += Math.ceil(excess)
      placed = placeValues(axis)
    }
  }

  for (const label of x.labels) alignEnd(label, plot.x)
  x.title =
    xShown && xAxis.title ? { text: xAxis.title, left: INSET, top: 0, align: 'start' } : undefined
  const valueLayout: AxisLayout = {
    position: values.position,
    scale: placed.scale,
    ticks: axis.ticks,
    labels: placed.labels,
    grid: values.grid,
    title:
      valuesShown && values.title
        ? bottomTitle(values.title, width, height, legendHeight)
        : undefined,
  }
  return { width, height, plot, x, y: { left: valueLayout } }
}

/** Puts a label's right edge a gap before `edge`. */
function alignEnd(label: TickLabel, edge: number) {
  label.left = edge - LABEL_GAP - label.width
}

function sideTitle(config: AxisConfig, width: number): AxisLayout['title'] {
  if (!config.title || config.hidden) return undefined
  const left = config.position !== 'right'
  return {
    text: config.title,
    top: 0,
    left: left ? INSET : width - INSET,
    align: left ? 'start' : 'end',
  }
}

function bottomTitle(
  text: string,
  width: number,
  height: number,
  legendHeight: number,
): AxisLayout['title'] {
  return { text, top: height - legendHeight - LABEL_HEIGHT, left: width - INSET, align: 'end' }
}

/** Labels centered under their ticks, kept inside the chart. */
function placeAcross(
  ticks: number[],
  texts: string[],
  scale: Scale,
  top: number,
  width: number,
  measure: (text: string) => number,
): TickLabel[] {
  return ticks.map((value, i) => {
    const text = texts[i]!
    const w = measure(text)
    return { text, width: w, left: clamp(scale.map(value) - w / 2, INSET, width - INSET - w), top }
  })
}

/** Labels centered beside their ticks, kept inside the chart; `left` is set by the caller. */
function placeDown(
  ticks: number[],
  texts: string[],
  scale: Scale,
  height: number,
  measure: (text: string) => number,
): TickLabel[] {
  return ticks.map((value, i) => {
    const text = texts[i]!
    return {
      text,
      width: measure(text),
      left: 0,
      top: clamp(scale.map(value) - LABEL_HEIGHT / 2, 0, height - LABEL_HEIGHT),
    }
  })
}

const fitAcross = (labels: TickLabel[]) => {
  for (let i = 1; i < labels.length; i++)
    if (labels[i]!.left < labels[i - 1]!.left + labels[i - 1]!.width + LABEL_GAP) return false
  return true
}

const fitDown = (labels: TickLabel[]) => {
  for (let i = 1; i < labels.length; i++)
    if (Math.abs(labels[i]!.top - labels[i - 1]!.top) < LABEL_HEIGHT + ROW_GAP) return false
  return true
}

/** Entries in rows that fit `width`, each row centered; `top` counts from the first row. */
export function placeLegend(
  names: string[],
  width: number,
  measure: (text: string) => number,
): LegendItem[] {
  const items: LegendItem[] = []
  let row: LegendItem[] = []
  let rowWidth = 0
  let top = 0
  const finish = () => {
    let left = Math.max(INSET, (width - rowWidth) / 2)
    for (const item of row) {
      item.left = left
      left += item.width + LEGEND_GAP
    }
    row = []
    rowWidth = 0
  }
  names.forEach((text, index) => {
    const w = SWATCH + SWATCH_GAP + measure(text)
    if (row.length && rowWidth + LEGEND_GAP + w > width - INSET * 2) {
      finish()
      top += LABEL_HEIGHT + LEGEND_ROW_GAP
    }
    const item = { index, text, left: 0, top, width: w }
    rowWidth += (row.length ? LEGEND_GAP : 0) + w
    row.push(item)
    items.push(item)
  })
  if (row.length) finish()
  return items
}

function labelWidth(texts: string[], measure: (text: string) => number): number {
  let widest = 0
  for (const text of texts) widest = Math.max(widest, measure(text))
  return Math.ceil(widest)
}

/* value axes */

interface ValueAxis {
  /** What it measures. */
  position: ChartValueAxis
  kind: 'linear' | 'log'
  domain: [number, number]
  ticks: number[]
  texts: string[]
  /** Whether both ends were given, so it can't be aligned to another axis. */
  fixed: boolean
}

function valueScale(axis: ValueAxis, range: [number, number]): Scale {
  return axis.kind === 'log' ? logScale(axis.domain, range) : linearScale(axis.domain, range)
}

function valueAxis(
  position: ChartValueAxis,
  config: AxisConfig,
  model: ChartModel,
  count: number,
  locale: string,
  length: number,
): ValueAxis {
  const kind = config.type === 'log' ? 'log' : 'linear'
  const data = model.y[position]
  const zero = config.zero ?? model.zero[position]
  let [lo, hi] = data
    ? kind === 'linear'
      ? widen(data[0], data[1], model.inset, length)
      : data
    : [0, 1]
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
    texts: valueTexts(ticks, config, locale),
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
  length: number,
): ValueAxis {
  if (axis.kind === 'log') return axis
  const data = model.y[axis.position]
  const zero = config.zero ?? model.zero[axis.position]
  let [lo, hi] = data ? widen(data[0], data[1], model.inset, length) : [0, 1]
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
        texts: valueTexts(ticks, config, locale),
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

function valueTexts(ticks: number[], config: AxisConfig, locale: string): string[] {
  if (config.format) return ticks.map((value) => config.format!(value))
  const format = numberTickFormat(locale, ticks)
  return ticks.map((value) => format(value))
}

/* the x axis */

/** The x scale over `range`; `count` is about how many ticks a nice number domain is rounded to. */
function xScale(
  config: AxisConfig,
  model: ChartModel,
  range: [number, number],
  count: number,
): Scale {
  const kind = model.xKind
  if (kind === 'category') return categoryScale(model.categories, range)
  const data = model.x ?? [0, 1]
  // bars sit centered on their x: leave half a band at both ends
  const pad = model.xStep > 0 ? model.xStep / 2 : 0
  const [from, to] = widen(data[0] - pad, data[1] + pad, model.inset, Math.abs(range[1] - range[0]))
  let lo = asNumber(config.min, kind) ?? from
  let hi = asNumber(config.max, kind) ?? to
  if (kind === 'time') {
    if (lo === hi) {
      lo -= 12 * 3600e3
      hi += 12 * 3600e3
    }
    return linearScale([lo, hi], range, 'time')
  }
  const domain = linearDomain(lo, hi, { count, nice: config.nice ?? false })
  if (config.min !== undefined) domain[0] = lo
  if (config.max !== undefined) domain[1] = hi
  return linearScale(domain, range)
}

/**
 * The ticks to try on the x axis with their texts, most first: the
 * caller takes the first whose labels fit. `length` is the axis length
 * in px and `space` the wanted room per tick.
 */
function* xTickChoices(
  config: AxisConfig,
  model: ChartModel,
  scale: Scale,
  length: number,
  space: number,
  locale: string,
): Generator<{ ticks: number[]; texts: string[] }> {
  const kind = model.xKind
  if (kind === 'category') {
    const text = (value: number) =>
      config.format ? config.format(model.categories[value]) : (model.categories[value] ?? '')
    // every category when they fit, else every second, third…
    const count = model.categories.length
    for (let every = 1; every <= Math.max(1, count); every++) {
      const ticks = categoryTicks(count, every)
      yield { ticks, texts: ticks.map(text) }
    }
    return
  }
  const explicit = explicitTicks(config, kind)
  const [lo, hi] = scale.domain
  const wanted = Math.max(2, Math.floor(length / space))
  if (kind === 'time') {
    for (let count = wanted; count >= 1; count--) {
      const interval = timeInterval(hi - lo, count)
      const ticks = explicit ?? timeTicks(lo, hi, interval)
      const format = timeTickFormat(locale, interval)
      yield {
        ticks,
        texts: ticks.map((value, i) =>
          config.format ? config.format(new Date(value)) : format(value, ticks[i - 1]),
        ),
      }
      if (explicit) return
    }
    return
  }
  // whole-number data (years): no ticks between them
  const most = model.xIntegers ? Math.max(1, Math.floor(hi - lo)) : wanted
  for (let count = Math.min(wanted, most); count >= 1; count--) {
    const ticks = explicit ?? linearTicks(lo, hi, count)
    const format = numberTickFormat(locale, ticks, { years: true })
    yield {
      ticks,
      texts: ticks.map((value) => (config.format ? config.format(value) : format(value))),
    }
    if (explicit) return
  }
}

/* charts without axes */

export interface PieLayout {
  width: number
  height: number
  /** The center and the outer radius, in px. */
  cx: number
  cy: number
  radius: number
  legend: LegendItem[]
}

/** A pie as large as fits above its legend. */
export function layoutPie({
  width,
  height,
  measure,
  legend: names = [],
}: Pick<LayoutOptions, 'width' | 'height' | 'measure' | 'legend'>): PieLayout {
  const legend = placeLegend(names, width, measure)
  const legendHeight = legendRoom(legend)
  for (const item of legend) item.top += height - legendHeight + LABEL_GAP + 4
  const room = height - legendHeight - EDGE * 2
  const radius = Math.max(1, Math.min(width - EDGE * 2, room) / 2)
  return { width, height, cx: width / 2, cy: EDGE + room / 2, radius, legend }
}
