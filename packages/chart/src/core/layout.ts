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
import { unitsOf, type Window } from './window'

/** Where an axis is drawn. */
export type ChartAxisPosition = 'bottom' | 'top' | 'left' | 'right'
/** What an axis measures: x, the values, or a second kind of values. */
export type ChartAxisRole = 'x' | ChartValueAxis
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
  /** The room for tick labels down the side, in px, whatever they measure. */
  labelWidth?: number
  /** Runs the other way: its scale's range is turned round. */
  reverse?: boolean
}

/** `range` as the axis runs: turned round when it is reversed. */
const runs = (config: AxisConfig | null | undefined, range: [number, number]): [number, number] =>
  config?.reverse ? [range[1], range[0]] : range

/** The axes by what they measure. */
export interface ChartAxes {
  x: AxisConfig
  y: AxisConfig | null
  y2: AxisConfig | null
}

export interface TickLabel {
  text: string
  /** Where the label's box goes, in px from the chart's top left. */
  left: number
  top: number
  width: number
  /** Whether the text is longer than `width` and is cut short with an ellipsis. */
  clipped?: boolean
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
  /** The whole domain, when zoomed in to part of it (`scale.domain`). */
  full: [number, number]
}

export interface ChartLayout {
  width: number
  height: number
  plot: Rect
  x: AxisLayout
  /** The value axes, by what they measure. */
  y: Partial<Record<ChartValueAxis, AxisLayout>>
  legend: LegendItem[]
  /** The room the legend shows in; its entries scroll in it when they don't all fit. */
  legendBox?: LegendBox
  /** Where the range strip goes: under the chart, or down its right side when horizontal. */
  strip?: Rect
}

/** Where a chart's legend goes. */
export type ChartLegendPlacement = 'top' | 'bottom' | 'right'

/** The room a legend shows in, in px from the chart's top left. */
export interface LegendBox extends Rect {
  /** Its entries take more room than it has: they scroll in it. */
  scroll: boolean
}

/** A legend entry, placed. */
export interface LegendItem {
  /** The entry's position in the names given. */
  index: number
  text: string
  left: number
  top: number
  width: number
  /** The name is longer than the room down the side, and is cut short. */
  clipped?: boolean
  /** The swatch's width, when wider than a series' (a heatmap's scale). */
  swatch?: number
}

/** A legend entry's name, or its name and a wider swatch (a heatmap's scale). */
export type LegendName = string | { text: string; swatch: number }

const nameText = (name: LegendName) => (typeof name === 'string' ? name : name.text)
const swatchOf = (name: LegendName) => (typeof name === 'string' ? SWATCH : name.swatch)

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
/** A heatmap's scale in the legend: wide enough to read from light to dark. */
export const HEAT_SWATCH = 40
const LEGEND_GAP = 16
const LEGEND_ROW_GAP = 4
/** Rows 40px apart on a touch screen: each entry's hit area reaches 12px past its text, above and below. */
const LEGEND_ROW_GAP_COARSE = 24
/** The most rows a legend above or below the chart shows; more scroll. */
const LEGEND_ROWS = 3
/** The most of the chart's width a legend down the side may take. */
const LEGEND_SIDE_SHARE = 0.3
/** The range strip's height (its width when horizontal), and the room before it. */
export const STRIP = 32
const STRIP_GAP = 12
/** Wanted room between ticks, in px. */
const X_TICK_SPACE = 64
const Y_TICK_SPACE = 48
/** Room between labels stacked down an axis. */
const ROW_GAP = 4
/** The most of the chart's width that category names down the side may take. */
const SIDE_LABEL_SHARE = 0.4

interface LayoutOptions {
  model: ChartModel
  axes: ChartAxes
  /** x runs down the left side and values along the bottom (and the top). */
  horizontal?: boolean
  width: number
  height: number
  locale: string
  measure: (text: string) => number
  /** Names for a legend, or none. */
  legend?: LegendName[]
  /** Rows of the legend far enough apart for a finger to press each (on a touch screen). */
  coarse?: boolean
  /** Where the legend goes: under the chart (the default), above it, or down its right side. */
  legendPlacement?: ChartLegendPlacement
  /**
   * The stretches shown when zoomed in: of x in the scale's numbers
   * (category indices, ms), of the values in those of `y` (or `y2` when
   * it is alone; `y2` follows `y`).
   */
  zoom?: { x?: Window | null; y?: Window | null }
  /** Leave room for a range strip. */
  strip?: boolean
  /** Room past the plot's end along x, in px, for labels at the ends of lines. */
  trailing?: number
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
  const placed = placeLegendIn(
    options.legend ?? [],
    options.legendPlacement ?? 'bottom',
    width,
    height,
    measure,
  )
  const { legend, box: legendBox } = placed
  const { bottom: legendHeight, top: legendTop, right: legendRight } = placed.room
  const room = options.strip ? STRIP + STRIP_GAP : 0
  if (options.horizontal) {
    // the strip down the right side, as tall as the plot
    const inner = width - room - legendRight
    const layout = layoutAcross({ ...options, width: inner }, legendHeight, legendTop)
    const { plot } = layout
    const strip = room
      ? { x: inner + STRIP_GAP, y: plot.y, width: STRIP, height: plot.height }
      : undefined
    return { ...layout, width, legend, legendBox, strip }
  }
  // the strip under the x axis, above the legend
  const layout = layoutUp(
    { ...options, width: width - legendRight },
    legendHeight + room,
    legendTop,
  )
  const { plot } = layout
  const strip = room
    ? { x: plot.x, y: height - legendHeight - STRIP, width: plot.width, height: STRIP }
    : undefined
  return { ...layout, width, legend, legendBox, strip }
}

/**
 * Places a legend's entries where it goes: in rows under or above the
 * chart, or one under another down its right side. Gives the room it
 * takes from the chart on each side, and the box it shows in: past three
 * rows (or the chart's height, down the side), its entries scroll.
 */
export function placeLegendIn(
  names: LegendName[],
  at: ChartLegendPlacement,
  width: number,
  height: number,
  measure: (text: string) => number,
  coarse = false,
): { legend: LegendItem[]; box?: LegendBox; room: { top: number; bottom: number; right: number } } {
  const rowGap = coarse ? LEGEND_ROW_GAP_COARSE : LEGEND_ROW_GAP
  const room = { top: 0, bottom: 0, right: 0 }
  if (!names.length) return { legend: [], room }
  if (at === 'right') {
    const widest = Math.max(
      SWATCH + SWATCH_GAP + 24,
      Math.floor(width * LEGEND_SIDE_SHARE) - LEGEND_GAP,
    )
    const step = LABEL_HEIGHT + Math.max(rowGap, LEGEND_ROW_GAP + 4)
    const legend = names.map((name, index) => {
      const text = nameText(name)
      const full = swatchOf(name) + SWATCH_GAP + measure(text)
      const item: LegendItem = {
        index,
        text,
        left: 0,
        top: index * step,
        width: Math.min(full, widest),
      }
      if (full > widest) item.clipped = true
      if (typeof name !== 'string') item.swatch = name.swatch
      return item
    })
    const boxWidth = Math.max(...legend.map((item) => item.width))
    const content = (legend.length - 1) * step + LABEL_HEIGHT
    const boxHeight = Math.min(content, height - EDGE * 2)
    const box: LegendBox = {
      x: width - INSET - boxWidth,
      y: EDGE,
      width: boxWidth,
      height: boxHeight,
      scroll: content > boxHeight + 0.5,
    }
    for (const item of legend) {
      item.left += box.x
      item.top += box.y
    }
    room.right = boxWidth + LEGEND_GAP
    return { legend, box, room }
  }
  const legend = placeLegend(names, width, measure, coarse)
  const rowStep = LABEL_HEIGHT + rowGap
  const content = legend[legend.length - 1]!.top + LABEL_HEIGHT
  const boxHeight = Math.min(content, (LEGEND_ROWS - 1) * rowStep + LABEL_HEIGHT)
  const gap = LABEL_GAP + 4
  const y = at === 'top' ? INSET : height - boxHeight
  for (const item of legend) item.top += y
  const box: LegendBox = { x: 0, y, width, height: boxHeight, scroll: content > boxHeight + 0.5 }
  if (at === 'top') room.top = INSET + boxHeight + gap - EDGE
  else room.bottom = boxHeight + gap
  return { legend, box, room }
}

const shown = (config: AxisConfig | null): config is AxisConfig => !!config && !config.hidden

/**
 * The value axes for about `count` ticks; the second one gets as many
 * steps as the first, so both share one set of grid lines.
 */
function valueAxes(
  axes: ChartAxes,
  model: ChartModel,
  count: number,
  locale: string,
  length: number,
  zoom?: Window | null,
  /** The values run across (a horizontal chart). */
  across = false,
  /** The most ticks whose labels fit, even when `ticks` asks for more. */
  most = Infinity,
): { y: ValueAxis | null; y2: ValueAxis | null } {
  let y = axes.y ? valueAxis('y', axes.y, model, count, locale, length, across, most) : null
  let y2 = axes.y2 ? valueAxis('y2', axes.y2, model, count, locale, length, across, most) : null
  if (y && y2 && !axes.y2!.ticks && !y2.fixed && y.ticks.length > 1) {
    const both = alignZero(y, y2, axes.y!, axes.y2!, model, locale, length)
    if (both) ({ y, y2 } = both)
    else y2 = alignTo(y2, y.ticks.length - 1, axes.y2!, model, locale, length)
  }
  const primary = y ?? y2
  if (!zoom || !primary) return { y, y2 }
  // the same part of each axis: y2 follows y
  const units = unitsOf({ kind: primary.kind })
  const [d0, d1] = primary.domain.map(units.to) as Window
  const part: Window = [
    (units.to(zoom[0]) - d0) / (d1 - d0 || 1),
    (units.to(zoom[1]) - d0) / (d1 - d0 || 1),
  ]
  const zoomed = (axis: ValueAxis | null, config: AxisConfig | null) =>
    axis && config ? zoomAxis(axis, part, count, config, locale, most) : null
  return { y: zoomed(y, axes.y), y2: zoomed(y2, axes.y2) }
}

/** `axis` zoomed in to `part` of it (0 to 1 from its start), with ticks of its own. */
function zoomAxis(
  axis: ValueAxis,
  part: Window,
  count: number,
  config: AxisConfig,
  locale: string,
  most = Infinity,
): ValueAxis {
  const units = unitsOf({ kind: axis.kind })
  const [d0, d1] = axis.domain.map(units.to) as Window
  const domain: Window = [
    units.from(d0 + (d1 - d0) * part[0]),
    units.from(d0 + (d1 - d0) * part[1]),
  ]
  count = tickCount(config, count, most)
  const given = explicitTicks(config, axis.kind)
  const ticks = given
    ? given.filter((v) => v >= domain[0] && v <= domain[1])
    : axis.kind === 'log'
      ? logTicks(domain[0], domain[1], count)
      : linearTicks(domain[0], domain[1], count)
  return { ...axis, full: axis.domain, domain, ticks, texts: valueTexts(ticks, config, locale) }
}

/** The data span an axis has to show, with 0 when it starts at 0. */
function extent(
  role: ChartValueAxis,
  config: AxisConfig,
  model: ChartModel,
  length: number,
): [number, number] {
  const data = model.y[role]
  let [lo, hi] = data ? widen(data[0], data[1], model.inset, length) : [0, 1]
  if (config.zero ?? model.zero[role]) {
    lo = Math.min(lo, 0)
    hi = Math.max(hi, 0)
  }
  return [lo, hi]
}

/**
 * Two linear axes that both reach below 0: 0 on one line, so bars on
 * both start from the same baseline. Each gets nice steps of its own, the
 * same number of them below 0 and above, as few as cover both. `null`
 * when it doesn't apply (an end or the ticks given, a log axis, all data
 * on one side of 0, where aligning the steps already lines up 0).
 */
function alignZero(
  y: ValueAxis,
  y2: ValueAxis,
  yConfig: AxisConfig,
  y2Config: AxisConfig,
  model: ChartModel,
  locale: string,
  length: number,
): { y: ValueAxis; y2: ValueAxis } | null {
  if (y.kind === 'log' || y2.kind === 'log') return null
  const given = (c: AxisConfig) => c.min !== undefined || c.max !== undefined || !!c.ticks
  if (given(yConfig) || given(y2Config)) return null
  const spans = [extent('y', yConfig, model, length), extent('y2', y2Config, model, length)]
  if (!spans.some(([lo, hi]) => lo < 0 && hi > 0) || spans.some(([lo, hi]) => lo > 0 || hi < 0))
    return null
  const intervals = y.ticks.length - 1
  const steps = spans.map(([lo, hi]) => {
    const choices: number[] = []
    let step = niceStep(hi - lo || 1, intervals * 2)
    for (let i = 0; i < 6; i++, step = nextNiceStep(step)) choices.push(step)
    return choices
  })
  let best: { s: [number, number]; below: number; above: number; fill: number } | null = null
  for (const s1 of steps[0]!)
    for (const s2 of steps[1]!) {
      const s: [number, number] = [s1, s2]
      const below = Math.max(...spans.map(([lo], i) => Math.ceil(-lo / s[i]! - 1e-9)))
      const above = Math.max(...spans.map(([, hi], i) => Math.ceil(hi / s[i]! - 1e-9)))
      const total = below + above
      if (total < Math.max(2, intervals - 1) || total > intervals + 1) continue
      // how much of each axis the data fills; the emptier one counts
      const fill = Math.min(...spans.map(([lo, hi], i) => (hi - lo) / (s[i]! * total)))
      if (!best || fill > best.fill + 1e-9) best = { s, below, above, fill }
    }
  if (!best) return null
  const { s, below, above } = best
  const make = (axis: ValueAxis, config: AxisConfig, step: number): ValueAxis => {
    const decimals = stepDecimals(step)
    const ticks = Array.from({ length: below + above + 1 }, (_, i) =>
      Number(((i - below) * step).toFixed(decimals)),
    )
    return {
      ...axis,
      domain: [ticks[0]!, ticks[ticks.length - 1]!],
      ticks,
      texts: valueTexts(ticks, config, locale),
    }
  }
  return { y: make(y, yConfig, s[0]), y2: make(y2, y2Config, s[1]) }
}

/** x along the bottom, values up the left side (and the right). */
function layoutUp(
  { model, axes, width, height, locale, measure, zoom, trailing = 0 }: LayoutOptions,
  legendHeight: number,
  /** Room taken at the top: a legend above the chart. */
  topRoom = 0,
): Omit<ChartLayout, 'legend'> {
  const xAxis = axes.x
  const xShown = !xAxis.hidden
  const titleRoom = (shown(axes.y) && axes.y.title) || (shown(axes.y2) && axes.y2.title)
  // a title sits above the top tick label, which is centered on the plot's top edge
  const top = (titleRoom ? LABEL_HEIGHT + LABEL_GAP + LABEL_HEIGHT / 2 : EDGE) + topRoom
  const bottom =
    (xShown ? LABEL_HEIGHT + LABEL_GAP + (xAxis.title ? LABEL_HEIGHT + 4 : 0) : EDGE) + legendHeight
  const plotTop = top
  const plotBottom = Math.max(plotTop + 1, height - bottom)
  const plotHeight = plotBottom - plotTop

  // value axes first: their labels decide how wide the plot is
  const yCount = Math.max(2, Math.floor(plotHeight / Y_TICK_SPACE))
  // as many labels as there are rows for them, whatever `ticks` asks
  const yMost = Math.max(2, Math.floor(plotHeight / (LABEL_HEIGHT + ROW_GAP)) + 1)
  const { y, y2 } = valueAxes(axes, model, yCount, locale, plotHeight, zoom?.y, false, yMost)
  const side = (axis: ValueAxis | null, config: AxisConfig | null) =>
    axis && shown(config)
      ? INSET + (config.labelWidth ?? labelWidth(axis.texts, measure)) + LABEL_GAP
      : EDGE
  const leftWidth = side(y, axes.y)
  const rightWidth = side(y2, axes.y2) + trailing
  const plot: Rect = {
    x: leftWidth,
    y: plotTop,
    width: Math.max(1, width - leftWidth - rightWidth),
    height: plotHeight,
  }

  const yLayout: ChartLayout['y'] = {}
  for (const axis of [y, y2]) {
    if (!axis) continue
    const config = axes[axis.role]!
    const scale = valueScale(axis, runs(config, [plot.y + plot.height, plot.y]))
    const labels = config.hidden ? [] : placeDown(axis.ticks, axis.texts, scale, height, measure)
    for (const label of labels)
      if (axis.role === 'y') alignEnd(label, plot.x)
      else label.left = plot.x + plot.width + trailing + LABEL_GAP
    yLayout[axis.role] = {
      position: config.position,
      scale,
      ticks: axis.ticks,
      labels,
      grid: config.grid,
      full: axis.full ?? axis.domain,
      title:
        config.title && !config.hidden
          ? topTitle(config.title, axis.role === 'y2', width, topRoom)
          : undefined,
    }
  }

  const along: [number, number] = [plot.x, plot.x + plot.width]
  const count = Math.max(2, Math.floor(plot.width / X_TICK_SPACE))
  const { scale, full } = xScale(xAxis, model, runs(xAxis, along), count, zoom?.x)
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
    x = { position: xAxis.position, scale, ticks, labels, grid: xAxis.grid, full }
    if (fitAcross(labels)) break
  }
  x ??= { position: xAxis.position, scale, ticks: [], labels: [], grid: xAxis.grid, full }
  if (!xShown) x.labels = []
  else if (xAxis.title) x.title = bottomTitle(xAxis.title, width, height, legendHeight)

  return { width, height, plot, x, y: yLayout }
}

/**
 * x down the left side, values along the bottom (and a second kind along
 * the top): bars with long category names.
 */
function layoutAcross(
  { model, axes, width, height, locale, measure, zoom }: LayoutOptions,
  legendHeight: number,
  /** Room taken at the top: a legend above the chart. */
  topRoom = 0,
): Omit<ChartLayout, 'legend'> {
  const xAxis = axes.x
  const xShown = !xAxis.hidden
  const yShown = shown(axes.y)
  const y2Shown = shown(axes.y2)
  // at the top: a row of titles (x on the left, y2 on the right), then y2's labels
  const titles = (xShown && xAxis.title) || (y2Shown && axes.y2!.title)
  const titleRow = titles ? LABEL_HEIGHT + LABEL_GAP : 0
  const topLabels = y2Shown ? LABEL_HEIGHT + LABEL_GAP : 0
  const top = Math.max(EDGE, titleRow + topLabels) + topRoom
  const bottom =
    (yShown ? LABEL_HEIGHT + LABEL_GAP + (axes.y!.title ? LABEL_HEIGHT + 4 : 0) : EDGE) +
    legendHeight
  const plotTop = top
  const plotBottom = Math.max(plotTop + 1, height - bottom)
  const plotHeight = plotBottom - plotTop

  // x first: its labels decide how far in the plot starts
  const down: [number, number] = [plotTop, plotBottom]
  const { scale, full } = xScale(
    xAxis,
    model,
    runs(xAxis, down),
    Math.max(2, Math.floor(plotHeight / Y_TICK_SPACE)),
    zoom?.x,
  )
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
    x = { position: xAxis.position, scale, ticks, labels, grid: xAxis.grid, full }
    if (fitDown(labels)) break
  }
  x ??= { position: xAxis.position, scale, ticks: [], labels: [], grid: xAxis.grid, full }
  if (!xShown) x.labels = []
  // long names are cut short, so they can't squeeze the plot away
  const widest = xAxis.labelWidth ?? Math.floor(width * SIDE_LABEL_SHARE)
  for (const label of x.labels)
    if (label.width > widest) {
      label.width = widest
      label.clipped = true
    }
  const leftWidth = !xShown
    ? EDGE
    : xAxis.labelWidth !== undefined
      ? INSET + xAxis.labelWidth + LABEL_GAP
      : x.labels.length
        ? INSET + labelWidth(x.labels.map((l) => l.width)) + LABEL_GAP
        : EDGE

  let rightWidth = EDGE
  const plot: Rect = { x: leftWidth, y: plotTop, width: 1, height: plotHeight }
  const across = width - leftWidth - EDGE
  const place = (axis: ValueAxis | null, labelTop: number, visible: boolean) => {
    if (!axis) return null
    const valueScaleAcross = valueScale(axis, runs(axes[axis.role], [plot.x, plot.x + plot.width]))
    const labels = visible
      ? placeAcross(axis.ticks, axis.texts, valueScaleAcross, labelTop, width, measure)
      : []
    return { axis, scale: valueScaleAcross, labels }
  }
  const placeAll = (axes2: { y: ValueAxis | null; y2: ValueAxis | null }) => {
    plot.width = Math.max(1, width - leftWidth - rightWidth)
    return {
      y: place(axes2.y, plotBottom + LABEL_GAP, yShown),
      y2: place(axes2.y2, plotTop - LABEL_GAP - LABEL_HEIGHT, y2Shown),
    }
  }
  let values = valueAxes(axes, model, 2, locale, across, zoom?.y, true, 2)
  let placed = placeAll(values)
  // fewer and fewer ticks until their labels fit side by side, `ticks` given or not
  const asked = [axes.y?.ticks, axes.y2?.ticks].filter((t): t is number => typeof t === 'number')
  const start = Math.max(2, Math.floor(across / X_TICK_SPACE), ...asked)
  // the last labels are centered on the plot's right edge: leave them room
  const placeWithRoom = () => {
    rightWidth = EDGE
    let out = placeAll(values)
    let excess = 0
    for (const p of [out.y, out.y2]) {
      const last = p?.labels[p.labels.length - 1]
      if (p && last)
        excess = Math.max(
          excess,
          p.scale.map(p.axis.ticks[p.axis.ticks.length - 1]!) + last.width / 2 + INSET - width,
        )
    }
    if (excess > 0) {
      rightWidth += Math.ceil(excess)
      out = placeAll(values)
    }
    return out
  }
  for (let count = start; count >= 2; count--) {
    values = valueAxes(axes, model, count, locale, across, zoom?.y, true, count)
    placed = placeWithRoom()
    if ((!placed.y || fitAcross(placed.y.labels)) && (!placed.y2 || fitAcross(placed.y2.labels)))
      break
  }

  for (const label of x.labels) alignEnd(label, plot.x)
  x.title =
    xShown && xAxis.title
      ? { text: xAxis.title, left: INSET, top: topRoom, align: 'start' }
      : undefined
  const yLayout: ChartLayout['y'] = {}
  for (const role of ['y', 'y2'] as const) {
    const p = placed[role]
    const config = axes[role]
    if (!p || !config) continue
    yLayout[role] = {
      position: config.position,
      scale: p.scale,
      ticks: p.axis.ticks,
      labels: p.labels,
      grid: config.grid,
      full: p.axis.full ?? p.axis.domain,
      title:
        config.title && !config.hidden
          ? role === 'y'
            ? bottomTitle(config.title, width, height, legendHeight)
            : topTitle(config.title, true, width, topRoom)
          : undefined,
    }
  }
  return { width, height, plot, x, y: yLayout }
}

/** Puts a label's right edge a gap before `edge`. */
function alignEnd(label: TickLabel, edge: number) {
  label.left = edge - LABEL_GAP - label.width
}

/** A title at the top: on the left, or (`end`) on the right. */
function topTitle(text: string, end: boolean, width: number, top = 0): AxisLayout['title'] {
  return { text, top, left: end ? width - INSET : INSET, align: end ? 'end' : 'start' }
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
  // left to right, whichever way the axis runs (a reversed one runs right to left)
  const list = [...labels]
  list.sort((a, b) => a.left - b.left)
  for (let i = 1; i < list.length; i++)
    if (list[i]!.left < list[i - 1]!.left + list[i - 1]!.width + LABEL_GAP) return false
  return true
}

const fitDown = (labels: TickLabel[]) => {
  for (let i = 1; i < labels.length; i++)
    if (Math.abs(labels[i]!.top - labels[i - 1]!.top) < LABEL_HEIGHT + ROW_GAP) return false
  return true
}

/** Entries in rows that fit `width`, each row centered; `top` counts from the first row. */
export function placeLegend(
  names: LegendName[],
  width: number,
  measure: (text: string) => number,
  coarse = false,
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
  names.forEach((name, index) => {
    const text = nameText(name)
    const w = swatchOf(name) + SWATCH_GAP + measure(text)
    if (row.length && rowWidth + LEGEND_GAP + w > width - INSET * 2) {
      finish()
      top += LABEL_HEIGHT + (coarse ? LEGEND_ROW_GAP_COARSE : LEGEND_ROW_GAP)
    }
    const item: LegendItem = { index, text, left: 0, top, width: w }
    if (typeof name !== 'string') item.swatch = name.swatch
    rowWidth += (row.length ? LEGEND_GAP : 0) + w
    row.push(item)
    items.push(item)
  })
  if (row.length) finish()
  return items
}

/** The widest of `texts` (measured), or of `widths`. */
function labelWidth(texts: string[], measure: (text: string) => number): number
function labelWidth(widths: number[]): number
function labelWidth(items: Array<string | number>, measure?: (text: string) => number): number {
  let widest = 0
  for (const item of items)
    widest = Math.max(widest, typeof item === 'number' ? item : measure!(item))
  return Math.ceil(widest)
}

/* value axes */

interface ValueAxis {
  /** What it measures. */
  role: ChartValueAxis
  kind: 'linear' | 'log'
  domain: [number, number]
  ticks: number[]
  texts: string[]
  /** Whether both ends were given, so it can't be aligned to another axis. */
  fixed: boolean
  /** The whole domain, when zoomed in. */
  full?: [number, number]
}

function valueScale(axis: ValueAxis, range: [number, number]): Scale {
  return axis.kind === 'log' ? logScale(axis.domain, range) : linearScale(axis.domain, range)
}

function valueAxis(
  role: ChartValueAxis,
  config: AxisConfig,
  model: ChartModel,
  count: number,
  locale: string,
  length: number,
  across = false,
  most = Infinity,
): ValueAxis {
  const listed = model.yCategories?.[role]
  if (listed) {
    // categories along the axis (a heatmap's rows): one band each, the first
    // at the top (at the left, across)
    const ticks = listed.map((_, i) => i)
    return {
      role,
      kind: 'linear',
      domain: across ? [-0.5, listed.length - 0.5] : [listed.length - 0.5, -0.5],
      ticks,
      texts: listed.map((label) => (config.format ? config.format(label) : label)),
      fixed: true,
    }
  }
  count = tickCount(config, count, most)
  const kind = config.type === 'log' ? 'log' : 'linear'
  const data = model.y[role]
  const zero = config.zero ?? model.zero[role]
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
  const given = explicitTicks(config, kind)
  let ticks =
    given ??
    (kind === 'log'
      ? logTicks(domain[0], domain[1], count)
      : linearTicks(domain[0], domain[1], count))
  // nice ends are ticks: an end the ticks' step falls short of reaches the next one
  if (!given && kind === 'linear' && (config.nice ?? true) && ticks.length > 1) {
    const step = ticks[1]! - ticks[0]!
    const decimals = stepDecimals(step)
    const from = min ?? Number((Math.floor(domain[0] / step + 1e-9) * step).toFixed(decimals))
    const to = max ?? Number((Math.ceil(domain[1] / step - 1e-9) * step).toFixed(decimals))
    if (from !== domain[0] || to !== domain[1]) {
      domain = [from, to]
      ticks = linearTicks(from, to, count)
    }
  }
  return {
    role,
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
  let [lo, hi] = extent(axis.role, config, model, length)
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

/**
 * How many ticks to aim for: the number given as `ticks`, else `count`
 * (what fits); never more than `most`, so asking for many on a narrow
 * chart doesn't pile the labels on one another.
 */
function tickCount(config: AxisConfig, count: number, most = Infinity): number {
  const asked =
    typeof config.ticks === 'number' && config.ticks >= 1 ? Math.round(config.ticks) : count
  return Math.max(1, Math.min(asked, most))
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
  zoom?: Window | null,
): { scale: Scale; full: [number, number] } {
  const scale = wholeXScale(config, model, range, count)
  const full = scale.domain
  if (!zoom) return { scale, full }
  // only the part zoomed in to, kept inside the whole
  const lo = Math.max(full[0], Math.min(zoom[0], zoom[1]))
  const hi = Math.min(full[1], Math.max(zoom[0], zoom[1]))
  if (!(hi > lo)) return { scale, full }
  const part = linearScale([lo, hi], range, scale.kind === 'time' ? 'time' : 'linear')
  if (scale.kind !== 'category') return { scale: part, full }
  const step = Math.abs(range[1] - range[0]) / (hi - lo)
  return { scale: { ...part, kind: 'category', step, categories: scale.categories }, full }
}

function wholeXScale(
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
  const domain = linearDomain(lo, hi, {
    count: tickCount(config, count),
    nice: config.nice ?? false,
  })
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
    // zoomed in: the categories whose middle is shown, still every nth of all, so they don't jump while panning
    const [lo, hi] = scale.domain
    const shownTicks = (ticks: number[]) =>
      lo <= -0.5 && hi >= count - 0.5 ? ticks : ticks.filter((i) => i >= lo && i <= hi)
    for (let every = 1; every <= Math.max(1, count); every++) {
      const ticks = shownTicks(categoryTicks(count, every))
      yield { ticks, texts: ticks.map(text) }
    }
    return
  }
  const explicit = explicitTicks(config, kind)
  const [lo, hi] = scale.domain
  const wanted = tickCount(config, Math.max(2, Math.floor(length / space)))
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
  /** The lowest the pie's labels may go: above the legend. */
  bottom: number
  legend: LegendItem[]
  legendBox?: LegendBox
}

/**
 * The box round the part of a circle of radius 1 from `start` to `end`
 * (radians clockwise from 12 o'clock), its center included, in units of
 * the radius from the center: a half circle is half as tall as a whole.
 */
export function arcBox(start: number, end: number) {
  let [left, right, top, bottom] = [0, 0, 0, 0]
  const take = (angle: number) => {
    const x = Math.sin(angle)
    const y = -Math.cos(angle)
    left = Math.min(left, x)
    right = Math.max(right, x)
    top = Math.min(top, y)
    bottom = Math.max(bottom, y)
  }
  take(start)
  take(end)
  // the quarters it passes: the top, the right, the bottom, the left
  for (let k = Math.ceil(start / (Math.PI / 2)); k * (Math.PI / 2) <= end; k++)
    take(k * (Math.PI / 2))
  return { left, right, top, bottom }
}

/** Room from a pie's edge to the labels outside it: the line out, and the gap before the text. */
export const PIE_LABEL_ROOM = 24

/**
 * A pie as large as fits above its legend; with labels outside, as large
 * as leaves room for the widest of them on each side, moved over towards
 * the side with the narrower labels.
 */
export function layoutPie({
  width,
  height,
  measure,
  legend: names = [],
  coarse,
  legendPlacement = 'bottom',
  sideLabels = { left: 0, right: 0 },
  arc = [0, Math.PI * 2],
}: Pick<LayoutOptions, 'width' | 'height' | 'measure' | 'legend' | 'coarse' | 'legendPlacement'> & {
  /** The widest label outside the pie on each side, in px; 0 for none. */
  sideLabels?: { left: number; right: number }
  /** The part of the turn the pie takes (a half donut's), in radians from 12 o'clock. */
  arc?: [number, number]
}): PieLayout {
  const placed = placeLegendIn(names, legendPlacement, width, height, measure, coarse)
  const { top, bottom, right: legendRight } = placed.room
  const room = height - top - bottom - EDGE * 2
  const inner = width - legendRight
  // labels outside: room for them on their side, and for the lines out above and below
  const left = sideLabels.left > 0 ? sideLabels.left + PIE_LABEL_ROOM : 0
  const right = sideLabels.right > 0 ? sideLabels.right + PIE_LABEL_ROOM : 0
  const across = inner - left - right
  const down = left || right ? room - LABEL_HEIGHT : room
  // a part of a circle (a half donut) takes only its own box: it grows to fill the room
  const box = arcBox(arc[0], arc[1])
  const radius = Math.max(
    1,
    Math.min((across - EDGE * 2) / (box.right - box.left || 1), down / (box.bottom - box.top || 1)),
  )
  return {
    width,
    height,
    cx: left + across / 2 - ((box.left + box.right) / 2) * radius,
    cy: top + EDGE + room / 2 - ((box.top + box.bottom) / 2) * radius,
    radius,
    bottom: height - bottom - EDGE,
    legend: placed.legend,
    legendBox: placed.box,
  }
}

/** A radar laid out: its center and radius, its rings and the names round it. */
export interface RadarLayout {
  width: number
  height: number
  cx: number
  cy: number
  radius: number
  /** How many spokes: one per category. */
  count: number
  /** From a value to its distance from the center, in px. */
  scale: Scale
  /** The values of the rings. */
  ticks: number[]
  /** The spokes' names round the rim. */
  labels: TickLabel[]
  /** The rings' values, between the first two spokes. */
  values: TickLabel[]
  legend: LegendItem[]
  legendBox?: LegendBox
}

/** Room between the rim and a spoke's name. */
const SPOKE_GAP = 8
/** The most of the chart's width a spoke's name may take, each side. */
const SPOKE_SHARE = 0.22
/** Wanted room between rings, in px. */
const RING_SPACE = 24

/**
 * Lays out a radar: the legend first, then the largest circle that leaves
 * room round it for the spokes' names (the categories), with rings at
 * nice values from the center (0, or the smallest value below it) out.
 */
export function layoutRadar({
  model,
  axes,
  width,
  height,
  locale,
  measure,
  legend: names = [],
  coarse,
  legendPlacement = 'bottom',
  spokes,
}: Omit<LayoutOptions, 'horizontal' | 'zoom' | 'strip' | 'trailing'> & {
  /** The spokes' names, in order from 12 o'clock. */
  spokes: string[]
}): RadarLayout {
  const placed = placeLegendIn(names, legendPlacement, width, height, measure, coarse)
  const { top, bottom, right: legendRight } = placed.room
  const across = width - legendRight
  const down = height - top - bottom
  const count = spokes.length
  const most = Math.max(24, Math.floor(across * SPOKE_SHARE))
  const widths = spokes.map((text) => measure(text))
  const angleOf = (i: number) => (i / Math.max(1, count)) * Math.PI * 2
  // the names beside the circle take room across; those at the top and bottom, down
  let side = 0
  widths.forEach((w, i) => {
    if (Math.abs(Math.sin(angleOf(i))) >= 0.1) side = Math.max(side, w)
  })
  side = Math.min(side, most)
  const radius = Math.max(
    1,
    Math.min(
      (across - (side + SPOKE_GAP) * 2 - EDGE * 2) / 2,
      (down - (LABEL_HEIGHT + SPOKE_GAP) * 2 - EDGE * 2) / 2,
    ),
  )
  const cx = across / 2
  const cy = top + down / 2
  const config = axes.y ?? { position: 'left' as const, grid: true, hidden: false }
  const axis = valueAxis(
    'y',
    config,
    model,
    Math.max(2, Math.floor(radius / RING_SPACE)),
    locale,
    radius,
  )
  const scale = linearScale(axis.domain, [0, radius])
  const labels: TickLabel[] = []
  if (!axes.x.hidden)
    spokes.forEach((text, i) => {
      const room = Math.min(widths[i]!, most)
      const sin = Math.sin(angleOf(i))
      const cos = Math.cos(angleOf(i))
      const x = cx + sin * (radius + SPOKE_GAP)
      const y = cy - cos * (radius + SPOKE_GAP)
      const where = Math.abs(sin) < 0.1 ? 0 : sin > 0 ? 1 : -1
      // the names at the top and bottom sit past the rim; those beside it, centered on their spoke
      const lift = where === 0 ? (cos > 0 ? LABEL_HEIGHT / 2 : -LABEL_HEIGHT / 2) : 0
      const label: TickLabel = {
        text,
        left: where === 0 ? x - room / 2 : where > 0 ? x : x - room,
        top: y - LABEL_HEIGHT / 2 - lift,
        width: room,
      }
      if (widths[i]! > most) label.clipped = true
      labels.push(label)
    })
  const values: TickLabel[] = []
  if (!config.hidden)
    axis.ticks.forEach((tick, i) => {
      const r = scale.map(tick)
      // the center needs no number: it is where the rings start
      if (r < 1) return
      const text = axis.texts[i]!
      // halfway between the first two spokes, just outside its ring: clear of the spokes and the dots on them
      const half = Math.PI / Math.max(2, count)
      const out = r * Math.cos(half)
      const x = cx + Math.sin(half) * out
      const y = cy - Math.cos(half) * out
      const label = { text, left: x + 2, top: y - LABEL_HEIGHT, width: measure(text) }
      // a spoke's name past the rim: the ring's value gives way to it
      const hits = labels.some(
        (other) =>
          label.left < other.left + other.width &&
          other.left < label.left + label.width &&
          label.top < other.top + LABEL_HEIGHT &&
          other.top < label.top + LABEL_HEIGHT,
      )
      if (!hits) values.push(label)
    })
  return {
    width,
    height,
    cx,
    cy,
    radius,
    count,
    scale,
    ticks: axis.ticks,
    labels,
    values,
    legend: placed.legend,
    legendBox: placed.box,
  }
}

/** A funnel laid out: where its stages go, and their names and values beside them. */
export interface FunnelLayout {
  width: number
  height: number
  /** Where the bars go: the widest takes its whole width. */
  plot: Rect
  /** How many stages, and the height of each one's row. */
  count: number
  step: number
  /** From a value to half its bar's width, in px. */
  scale: Scale
  /** The stages' names, on the left. */
  names: TickLabel[]
  /** Their values, on the right, and the share each kept of the one before it. */
  values: TickLabel[]
  rates: TickLabel[]
  legend: LegendItem[]
  legendBox?: LegendBox
}

/** Room between a funnel's bars and the text beside them, and between a value and its rate. */
const FUNNEL_GAP = 12
const RATE_GAP = 8
/** The most of the chart's width the names may take. */
const FUNNEL_NAME_SHARE = 0.3
/** The tallest a stage's row grows, in px: a few stages don't fill a tall chart with bars. */
const FUNNEL_STEP = 64

/**
 * Lays out a funnel: the legend, then the names in a column on the left
 * and the values (with rates) on the right, and the bars between them.
 */
export function layoutFunnel({
  width,
  height,
  measure,
  legend: names = [],
  coarse,
  legendPlacement = 'bottom',
  stages,
  values: written,
  rates: rateTexts,
  max,
}: Pick<LayoutOptions, 'width' | 'height' | 'measure' | 'legend' | 'coarse' | 'legendPlacement'> & {
  stages: string[]
  values: string[]
  /** The share each stage kept of the one before, written; `null` for the first. */
  rates: Array<string | null>
  /** The largest value: its bar is the widest. */
  max: number
}): FunnelLayout {
  const placed = placeLegendIn(names, legendPlacement, width, height, measure, coarse)
  const { top, bottom, right: legendRight } = placed.room
  const across = width - legendRight
  const count = stages.length
  const most = Math.floor(across * FUNNEL_NAME_SHARE)
  const nameWidths = stages.map((text) => Math.min(measure(text), most))
  const valueWidths = written.map((text) => measure(text))
  const rateWidths = rateTexts.map((text) => (text ? measure(text) : 0))
  const valueColumn = Math.max(0, ...valueWidths)
  const rateColumn = Math.max(0, ...rateWidths)
  const left = INSET + Math.max(0, ...nameWidths) + FUNNEL_GAP
  const right = FUNNEL_GAP + valueColumn + (rateColumn ? RATE_GAP + rateColumn : 0) + INSET
  const room = Math.max(1, height - top - bottom - EDGE * 2)
  const step = count ? Math.min(FUNNEL_STEP, room / count) : room
  const plotHeight = step * count
  const plot: Rect = {
    x: left,
    y: top + EDGE + (room - plotHeight) / 2,
    width: Math.max(1, across - left - right),
    height: plotHeight,
  }
  const scale = linearScale([0, max > 0 ? max : 1], [0, plot.width / 2])
  const middle = (i: number) => plot.y + step * i + step / 2 - LABEL_HEIGHT / 2
  const labels = stages.map((text, i) => {
    const label: TickLabel = {
      text,
      left: plot.x - FUNNEL_GAP - nameWidths[i]!,
      top: middle(i),
      width: nameWidths[i]!,
    }
    if (measure(text) > most) label.clipped = true
    return label
  })
  const valueLeft = plot.x + plot.width + FUNNEL_GAP
  const values = written.map((text, i) => ({
    text,
    // right-aligned in their column, so the digits line up
    left: valueLeft + valueColumn - valueWidths[i]!,
    top: middle(i),
    width: valueWidths[i]!,
  }))
  const rates: TickLabel[] = []
  rateTexts.forEach((text, i) => {
    if (!text) return
    rates.push({
      text,
      left: valueLeft + valueColumn + RATE_GAP + rateColumn - rateWidths[i]!,
      top: middle(i),
      width: rateWidths[i]!,
    })
  })
  return {
    width,
    height,
    plot,
    count,
    step,
    scale,
    names: labels,
    values,
    rates,
    legend: placed.legend,
    legendBox: placed.box,
  }
}
