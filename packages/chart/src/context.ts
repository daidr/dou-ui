import {
  getCurrentInstance,
  inject,
  onBeforeUnmount,
  onMounted,
  type InjectionKey,
  type Ref,
  type VNodeChild,
} from 'vue'
import type { ChartData } from './core/data'
import type { ChartSeriesKind, ChartSeriesProps } from './core/series'
import type {
  ChartAxisProps,
  ChartBrushEvent,
  ChartBrushProps,
  ChartInterval,
  ChartMarkerProps,
  ChartPieProps,
  ChartSunburstProps,
  ChartTooltipProps,
  ChartTooltipSlots,
  ChartZoomProps,
} from './types'

/** A child component as the chart keeps it. */
export interface ChartPart<P> {
  props: P
  /** The child's place in the page, which orders the children as written. */
  el: () => Node | null
}

export interface SeriesPart extends ChartPart<ChartSeriesProps & Record<string, unknown>> {
  kind: ChartSeriesKind<any>
  /** Turned off in the legend (`v-model:hidden`). */
  hidden: Ref<boolean>
}

export interface PiePart extends ChartPart<ChartPieProps> {
  /** What goes in the hole of a donut. */
  center: () => VNodeChild
  /** The labels of the slices turned off in the legend (`v-model:hidden`). */
  hidden: Ref<string[]>
  /**
   * For a gauge, drawn as a pie of its value and the rest of its track:
   * the value, its range and its text. It has no legend nor tooltip.
   */
  gauge?: () => { value: number; min: number; max: number; text: string }
}

export interface TreePart extends ChartPart<ChartSunburstProps> {
  /** A treemap fills a rectangle; a sunburst draws rings round a center. */
  shape: 'treemap' | 'sunburst'
  /** What goes in a sunburst's hole. */
  center?: () => VNodeChild
}

export interface TooltipPart extends ChartPart<ChartTooltipProps> {
  /** The tooltip's slot, if one is given. */
  content: () => ChartTooltipSlots['default']
}

export type AxisPart = ChartPart<ChartAxisProps>

/** A stretch of x and of the values; `null` (or left out) for none. */
export interface IntervalModels {
  x: Ref<ChartInterval | null | undefined>
  y: Ref<ChartInterval | null | undefined>
}

export interface ZoomPart extends ChartPart<ChartZoomProps>, IntervalModels {}

export interface BrushPart extends ChartPart<ChartBrushProps>, IntervalModels {
  /** A stretch was selected: tells the page. */
  select: (event: ChartBrushEvent) => void
}

export interface RangePart extends ChartPart<Record<string, never>> {
  x: Ref<ChartInterval | null | undefined>
}

export type MarkerPart = ChartPart<ChartMarkerProps>

export interface ChartRegistry {
  addSeries(part: SeriesPart): () => void
  addAxis(part: AxisPart): () => void
  addPie(part: PiePart): () => void
  addTooltip(part: TooltipPart): () => void
  addZoom(part: ZoomPart): () => void
  addBrush(part: BrushPart): () => void
  addRange(part: RangePart): () => void
  addMarker(part: MarkerPart): () => void
  addTree(part: TreePart): () => void
  /** The chart's `data`, for a part that works its rows out from it (a histogram's bins). */
  data(): ChartData | undefined
  /** The chart's locale, for numbers a part writes itself (a gauge's value). */
  locale(): string
}

export const chartKey: InjectionKey<ChartRegistry> = Symbol('DouChart')

/**
 * The render of a part: it draws nothing itself. A comment in the page on
 * the server and in the browser alike, so taking over a server-rendered
 * page finds each part where it expects it (an empty template renders
 * nothing at all on the server).
 */
export const renderNothing = () => null

/** Registers a child (a series, an axis) with the surrounding chart while it is mounted. */
export function useChartPart(name: string, add: (registry: ChartRegistry) => () => void) {
  const registry = inject(chartKey, null)
  if (!registry) {
    if (process.env.NODE_ENV !== 'production')
      console.warn(`[@dou-ui/chart] <${name}> must be placed inside <DouChart>.`)
    return
  }
  let remove: (() => void) | undefined
  onBeforeUnmount(() => remove?.())
  // on the server, and while taking over the page it rendered, the chart
  // draws before anything mounts: it needs its parts now
  if (typeof window === 'undefined' || getCurrentInstance()?.vnode.el) remove = add(registry)
  else onMounted(() => (remove = add(registry)))
}

/** The node a renderless child leaves in the page. */
export function useOwnNode(): () => Node | null {
  const instance = getCurrentInstance()
  return () => (instance?.vnode.el as Node | null) ?? null
}
