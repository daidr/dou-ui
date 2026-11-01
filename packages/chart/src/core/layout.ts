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
}

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
  legend?: string[]
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
  names: string[],
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
    const legend = names.map((text, index) => {
      const full = SWATCH + SWATCH_GAP + measure(text)
      const item: LegendItem = {
        index,
        text,
        left: 0,
        top: index * step,
        width: Math.min(full, widest),
      }
      if (full > widest) item.clipped = true
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
): { y: ValueAxis | null; y2: ValueAxis | null } {
  let y = axes.y ? valueAxis('y', axes.y, model, count, locale, length) : null
  let y2 = axes.y2 ? valueAxis('y2', axes.y2, model, count, locale, length) : null
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
    axis && config ? zoomAxis(axis, part, count, config, locale) : null
  return { y: zoomed(y, axes.y), y2: zoomed(y2, axes.y2) }
}

/** `axis` zoomed in to `part` of it (0 to 1 from its start), with ticks of its own. */
function zoomAxis(
  axis: ValueAxis,
  part: Window,
  count: number,
  config: AxisConfig,
  locale: string,
): ValueAxis {
  const units = unitsOf({ kind: axis.kind })
  const [d0, d1] = axis.domain.map(units.to) as Window
  const domain: Window = [
    units.from(d0 + (d1 - d0) * part[0]),
    units.from(d0 + (d1 - d0) * part[1]),
  ]
  count = tickCount(config, count)
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
  const { y, y2 } = valueAxes(axes, model, yCount, locale, plotHeight, zoom?.y)
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
    const scale = valueScale(axis, [plot.y + plot.height, plot.y])
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
  const { scale, full } = xScale(xAxis, model, along, count, zoom?.x)
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
    down,
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
    const valueScaleAcross = valueScale(axis, [plot.x, plot.x + plot.width])
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
  let values = valueAxes(axes, model, 2, locale, across, zoom?.y)
  let placed = placeAll(values)
  for (let count = Math.max(2, Math.floor(across / X_TICK_SPACE)); count >= 2; count--) {
    values = valueAxes(axes, model, count, locale, across, zoom?.y)
    placed = placeAll(values)
    if ((!placed.y || fitAcross(placed.y.labels)) && (!placed.y2 || fitAcross(placed.y2.labels)))
      break
  }
  // the last labels are centered on the plot's right edge: leave them room
  let excess = 0
  for (const p of [placed.y, placed.y2]) {
    const last = p?.labels[p.labels.length - 1]
    if (p && last)
      excess = Math.max(
        excess,
        p.scale.map(p.axis.ticks[p.axis.ticks.length - 1]!) + last.width / 2 + INSET - width,
      )
  }
  if (excess > 0) {
    rightWidth += Math.ceil(excess)
    placed = placeAll(values)
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
  names.forEach((text, index) => {
    const w = SWATCH + SWATCH_GAP + measure(text)
    if (row.length && rowWidth + LEGEND_GAP + w > width - INSET * 2) {
      finish()
      top += LABEL_HEIGHT + (coarse ? LEGEND_ROW_GAP_COARSE : LEGEND_ROW_GAP)
    }
    const item = { index, text, left: 0, top, width: w }
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
): ValueAxis {
  count = tickCount(config, count)
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

/** How many ticks to aim for: the number given as `ticks`, else `count` (what fits). */
function tickCount(config: AxisConfig, count: number): number {
  return typeof config.ticks === 'number' && config.ticks >= 1 ? Math.round(config.ticks) : count
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
  legend: LegendItem[]
  legendBox?: LegendBox
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
}: Pick<LayoutOptions, 'width' | 'height' | 'measure' | 'legend' | 'coarse' | 'legendPlacement'> & {
  /** The widest label outside the pie on each side, in px; 0 for none. */
  sideLabels?: { left: number; right: number }
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
  const radius = Math.max(1, Math.min(across - EDGE * 2, down) / 2)
  return {
    width,
    height,
    cx: left + across / 2,
    cy: top + EDGE + room / 2,
    radius,
    legend: placed.legend,
    legendBox: placed.box,
  }
}
