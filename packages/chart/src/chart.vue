<script setup lang="ts">
import {
  holdPointer,
  svgToPNG,
  useElementSize,
  useLocale,
  useNamespace,
  useReducedMotion,
  type PointerHold,
} from 'dou-ui'
import {
  computed,
  getCurrentInstance,
  onBeforeUnmount,
  onMounted,
  provide,
  ref,
  shallowRef,
  toRaw,
  useId,
  useTemplateRef,
  watch,
  type VNodeChild,
} from 'vue'
import { createColorResolver, observeTheme } from './core/colors'
import { extent, read, rowOf, type ChartAccessor, type ChartRow } from './core/data'
import { allX, angleAt, nearestPoint, nearestX, neighborGap, rowAt, sortedOrder } from './core/hit'
import { joinGroup, tellGroup, type SharedX } from './core/sync'
import { numberFormatFull, numberTickFormat, timeFormatFull, timePrecision } from './core/format'
import {
  layoutChart,
  layoutPie,
  PIE_LABEL_ROOM,
  type AxisConfig,
  type AxisLayout,
  type ChartAxes,
  type ChartLayout,
  type ChartAxisPosition,
  type ChartAxisRole,
  type ChartLegendPlacement,
  type ChartTickValue,
  type TickLabel,
} from './core/layout'
import {
  buildModel,
  seriesName,
  smallestGap,
  type ChartModel,
  type SeriesInput,
} from './core/model'
import { drawMarkers, placeMarkers, type MarkerColors, type MarkerInput } from './core/marker'
import { barPlacement } from './core/bar'
import {
  contrast,
  DATA_LABEL,
  luminance,
  placeDataLabels,
  spread,
  type DataLabelInput,
  type PlacedDataLabel,
} from './core/labels'
import { crisp, type Painter, type Rect } from './core/painter'
import { drawPie, FADED, pieSlices, type PieSlice } from './core/pie'
import { baseline, categoryScale, linearScale, logScale, type Scale } from './core/scale'
import { escapeXml, isSvg, num, paintAttribute, SvgPainter } from './core/svg'
import type { ChartColors, ChartHit, ChartSeries, ChartValueAxis, ChartView } from './core/series'
import {
  clampWindow,
  intervalToWindow,
  panWindow,
  snapCategories,
  unitsOf,
  valueToNumber,
  windowToInterval,
  within,
  zoomWindow,
  type Window,
} from './core/window'
import {
  chartKey,
  type AxisPart,
  type BrushPart,
  type ChartPart,
  type MarkerPart,
  type PiePart,
  type SeriesPart,
  type RangePart,
  type TooltipPart,
  type ZoomPart,
} from './context'
import { format, useChartMessages } from './locale'
import ChartOverlay, { type OverlayState } from './overlay.vue'
import ChartPointer, { type PointerState, type Tip } from './pointer.vue'
import ChartTable, { type TableState } from './table.vue'
import ChartStatic, { type StaticState } from './static.vue'
import ChartZoomLayer, { type ZoomLayerState } from './zoom-layer.vue'
import type { Tone } from 'dou-ui'
import type {
  ChartBrushEvent,
  ChartExportOptions,
  ChartExpose,
  ChartImageOptions,
  ChartInterval,
  ChartMarkerProps,
  ChartProps,
  ChartSelectEvent,
  ChartSlots,
  ChartLabelFormat,
  ChartTooltipItem,
} from './types'

defineOptions({ name: 'DouChart' })

const props = withDefaults(defineProps<ChartProps>(), {
  data: () => [],
  height: 320,
  ssrWidth: 640,
  // left out: shown when there is more than one series
  legend: undefined,
})
const slots = defineSlots<ChartSlots>()
const emit = defineEmits<{
  /** A bar, point or slice was clicked, or Enter pressed on it: what the tooltip shows there. */
  select: [event: ChartSelectEvent]
  /** The table view was closed with Escape. */
  'update:table': [value: boolean]
}>()

const ns = useNamespace('chart')
const { locale } = useLocale()
const messages = useChartMessages(() => props.messages)

const rootRef = useTemplateRef<HTMLElement>('root')
const canvasRef = useTemplateRef<HTMLCanvasElement>('canvas')
const instance = getCurrentInstance()
/**
 * Drawn on the server, or taking over a page drawn there: until the canvas
 * has drawn, the chart is an SVG at `ssrWidth` (the server can't know the width).
 */
const fromServer = ref(typeof window === 'undefined' || !!instance?.vnode.el)
const size = useElementSize(
  rootRef,
  fromServer.value
    ? {
        initial: {
          width: props.ssrWidth,
          height: typeof props.height === 'number' ? props.height : 320,
        },
      }
    : {},
)

/* the parts written inside the chart, in the order they are written */

const seriesParts = shallowRef<SeriesPart[]>([])
const axisParts = shallowRef<AxisPart[]>([])
const pieParts = shallowRef<PiePart[]>([])
const tooltipParts = shallowRef<TooltipPart[]>([])
const zoomParts = shallowRef<ZoomPart[]>([])
const brushParts = shallowRef<BrushPart[]>([])
const rangeParts = shallowRef<RangePart[]>([])
const markerParts = shallowRef<MarkerPart[]>([])

function inPageOrder<T extends ChartPart<unknown>>(parts: T[]): T[] {
  // oxlint-disable-next-line unicorn/no-array-sort -- sorts a copy
  return [...parts].sort((a, b) => {
    const [x, y] = [a.el(), b.el()]
    if (!x || !y) return 0
    return x.compareDocumentPosition(y) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
  })
}

function adder<T extends ChartPart<unknown>>(parts: { value: T[] }) {
  return (part: T) => {
    parts.value = inPageOrder([...parts.value, part])
    return () => (parts.value = parts.value.filter((p) => p !== part))
  }
}

provide(chartKey, {
  addSeries: adder(seriesParts),
  addAxis: adder(axisParts),
  addPie: adder(pieParts),
  addTooltip: adder(tooltipParts),
  addZoom: adder(zoomParts),
  addBrush: adder(brushParts),
  addRange: adder(rangeParts),
  addMarker: adder(markerParts),
})

/* theme: colors are read from CSS and read again when the theme changes */

const themeVersion = ref(0)
const resolveColor = createColorResolver(() => rootRef.value)

function readTheme() {
  resolveColor.clear()
  measured.clear()
  themeVersion.value++
}

let stopTheme: (() => void) | undefined

/** A touch screen: the legend's rows go further apart, for a finger. */
const coarse = ref(false)
const coarseQuery =
  typeof window === 'undefined' || !window.matchMedia
    ? undefined
    : window.matchMedia('(pointer: coarse)')
const readCoarse = () => (coarse.value = !!coarseQuery?.matches)
onMounted(() => {
  readCoarse()
  coarseQuery?.addEventListener?.('change', readCoarse)
})
onBeforeUnmount(() => coarseQuery?.removeEventListener?.('change', readCoarse))
// a font that loads after the labels were measured makes them wider: measured again
const fonts = typeof document === 'undefined' ? undefined : document.fonts
onMounted(() => {
  readTheme()
  stopTheme = observeTheme(readTheme)
  fonts?.addEventListener?.('loadingdone', readTheme)
})
onBeforeUnmount(() => {
  stopTheme?.()
  fonts?.removeEventListener?.('loadingdone', readTheme)
})

const colors = computed<ChartColors>(() => {
  void themeVersion.value
  return {
    surface: resolveColor('var(--dou-chart-surface)'),
    grid: resolveColor('var(--dou-chart-grid)'),
    baseline: resolveColor('var(--dou-chart-baseline)'),
  }
})

/* text width, for laying out tick labels */

// measured in the page, with the labels' own styles: a canvas can pick other fallback fonts
const measured = new Map<string, number>()
let measurer: HTMLElement | null = null
function measure(text: string): number {
  let width = measured.get(text)
  if (width !== undefined) return width
  const root = rootRef.value
  if (root && typeof document !== 'undefined') {
    if (!measurer || measurer.parentNode !== root) {
      measurer = document.createElement('span')
      measurer.className = `${ns.e('tick')} ${ns.e('measure')}`
      measurer.setAttribute('aria-hidden', 'true')
      measurer.appendChild(document.createElement('span')).className = ns.e('text')
      root.appendChild(measurer)
    }
    measurer.firstChild!.textContent = text
    width = measurer.getBoundingClientRect().width
  }
  if (!width) {
    // not in a page (tests, the server): a fair guess, wide for CJK
    width = 0
    for (const char of text) width += char.charCodeAt(0) > 0x2e80 ? 12 : 7
  }
  measured.set(text, width)
  return width
}

/* data → model → layout */

const declaredAxes = computed(() => {
  const declared: Partial<Record<ChartAxisRole, AxisPart['props']>> = {}
  for (const part of axisParts.value) declared[part.props.for] = part.props
  return declared
})

// with only a y2 axis written, series that don't say otherwise are measured on it
const defaultAxis = computed<ChartValueAxis>(() =>
  declaredAxes.value.y2 && !declaredAxes.value.y ? 'y2' : 'y',
)

const uses = (axis: ChartValueAxis) =>
  seriesParts.value.some((part) => (part.props.axis ?? defaultAxis.value) === axis)

/**
 * The axes by what they measure, and where each is drawn: x at the bottom,
 * y on the left and y2 on the right; with `horizontal`, x on the left,
 * y at the bottom and y2 at the top.
 */
const axes = computed<ChartAxes>(() => {
  const declared = declaredAxes.value
  const places: Record<ChartAxisRole, ChartAxisPosition> = props.horizontal
    ? { x: 'left', y: 'bottom', y2: 'top' }
    : { x: 'bottom', y: 'left', y2: 'right' }
  const config = (role: ChartAxisRole, grid: boolean): AxisConfig => {
    const {
      for: _,
      percent: share,
      ...given
    } = declared[role] ?? ({} as Partial<AxisPart['props']>)
    const position = places[role]
    const out: AxisConfig = {
      ...given,
      position,
      grid: given.grid ?? grid,
      hidden: given.hidden ?? false,
    }
    // shares of a whole: up to 100%, written as percentages
    if (share && role !== 'x') {
      out.format ??= percentTicks.value.format
      out.max ??= 1
    }
    return out
  }
  const y = declared.y || uses('y') || !uses('y2')
  return {
    x: config('x', false),
    y: y ? config('y', true) : null,
    // grid lines go with y, or with y2 when it is alone
    y2: declared.y2 || uses('y2') ? config('y2', !y) : null,
  }
})

const model = computed(() => {
  const inputs: SeriesInput[] = seriesParts.value.map((part, index) => ({
    index,
    kind: part.kind,
    props: part.props,
    hidden: part.hidden.value,
  }))
  const type = axes.value.x.type
  const built = buildModel(inputs, {
    data: toRaw(props.data),
    x: props.x,
    xKind: type === 'log' ? 'linear' : type,
    axis: defaultAxis.value,
    percent: { y: !!declaredAxes.value.y?.percent, y2: !!declaredAxes.value.y2?.percent },
  })
  return labelRoom(reachMarkers(built))
})

/** Percentages on the ticks of a `percent` axis: whole ones. */
const percentTicks = computed(
  () => new Intl.NumberFormat(locale.value.name, { style: 'percent', maximumFractionDigits: 0 }),
)

/** Room past the data on each value axis for labels outside bars and above points: a part of its span. */
const LABEL_ROOM = 0.12

/**
 * The model with room on each value axis for data labels past the bars'
 * ends and above the points, so the highest one isn't left out.
 */
function labelRoom(m: ChartModel): ChartModel {
  const wanted = new Set<ChartValueAxis>()
  for (const s of m.series) {
    const p = s.input.props as { labels?: unknown; labelPosition?: string }
    if (!p.labels || !s.input.kind.labels || p.labelPosition === 'end') continue
    // in the bars (stacked ones by default): no room needed past them
    if (p.labelPosition === 'inside' || (s.stackEnds && s.input.kind.band && !p.labelPosition))
      continue
    wanted.add(s.axis)
  }
  if (!wanted.size) return m
  const y = { ...m.y }
  for (const axis of wanted) {
    const known = y[axis]
    if (!known) continue
    // the span as the axis shows it: from 0, when it grows from there
    const zero = declaredAxes.value[axis]?.zero ?? m.zero[axis]
    const lo = zero ? Math.min(known[0], 0) : known[0]
    const hi = zero ? Math.max(known[1], 0) : known[1]
    const span = hi - lo || Math.abs(hi) || 1
    y[axis] = [
      lo < 0 ? known[0] - span * LABEL_ROOM : known[0],
      hi > 0 ? known[1] + span * LABEL_ROOM : known[1],
    ]
  }
  return { ...m, y }
}

/** The model with each value axis reaching the markers' values on it, so a target shows. */
function reachMarkers(m: ChartModel): ChartModel {
  let y: ChartModel['y'] | null = null
  for (const part of markerParts.value) {
    const value = part.props.y
    if (value === undefined) continue
    const axis = part.props.axis ?? defaultAxis.value
    const known = (y ?? m.y)[axis]
    // an axis with no data stays empty: a marker alone isn't a chart
    if (!known) continue
    let [lo, hi] = known
    for (const v of Array.isArray(value) ? value : [value]) {
      if (!Number.isFinite(v)) continue
      lo = Math.min(lo, v)
      hi = Math.max(hi, v)
    }
    // a line above all the data, with a label: room over it for the label
    // (a line or a point above all the data, with a label: room over it for the label)
    if (part.props.label && !Array.isArray(value) && !Array.isArray(part.props.x) && value >= hi)
      hi = value + (value - lo) * 0.1
    if (lo !== known[0] || hi !== known[1]) {
      y ??= { ...m.y }
      y[axis] = [lo, hi]
    }
  }
  return y ? { ...m, y } : m
}

/* a pie: drawn alone, without axes */

const pie = computed(() => pieParts.value[0] ?? null)

const slices = computed(() => {
  const part = pie.value
  if (!part) return []
  const label = part.props.label ?? props.x
  return pieSlices(
    toRaw(part.props.data ?? props.data),
    part.props.value,
    label,
    part.props.color,
    part.hidden.value,
  )
})

/** The slices that take room: not turned off. */
const shownSlices = computed(() => slices.value.filter((slice) => !slice.hidden))

if (process.env.NODE_ENV !== 'production')
  watch([pieParts, seriesParts], ([pies, series]) => {
    if (pies.length > 1 || (pies.length && series.length))
      console.warn(
        '[@dou-ui/chart] a <DouChartPie> is drawn alone: other series and pies are left out.',
      )
  })

/** No series has a value to show. */
const empty = computed(() =>
  pie.value ? !shownSlices.value.length : !model.value.y.y && !model.value.y.y2,
)

// a number axis of what look like times in ms: most likely meant as a time axis
let timestampWarned = false
watch(model, (m) => {
  if (process.env.NODE_ENV === 'production' || timestampWarned) return
  if (m.xKind !== 'linear' || axes.value.x.type || !m.x) return
  if (m.x[0] > 1e11 && m.x[1] < 1e13) {
    timestampWarned = true
    console.warn(
      '[@dou-ui/chart] the x values look like times in ms. Add <DouChartAxis for="x" type="time" /> to show them as dates.',
    )
  }
})

const TONES = new Set(['neutral', 'primary', 'success', 'warning', 'danger'])

/** A color given as a CSS color or a tone name, as CSS. */
const toneOrColor = (color: string) =>
  color === 'neutral'
    ? 'var(--dou-color-chart-1)'
    : TONES.has(color)
      ? `var(--dou-color-${color})`
      : color

/** The chart's own palette (`palette`), when one is given. */
const ownPalette = computed(() => (props.palette?.length ? props.palette : null))

/** The palette's color for the series at `index`: the chart's own, or the theme's eight. */
function paletteColor(index: number): string {
  const own = ownPalette.value
  return own ? toneOrColor(own[index % own.length]!) : `var(--dou-color-chart-${(index % 8) + 1})`
}

/** A series' color: its own, its tone's, or the palette's by its place among all series. */
function seriesColor(p: SeriesPart['props'], index: number): string {
  const own = typeof p.color === 'string' ? p.color : undefined
  return resolveColor(own ?? (p.tone ? `var(--dou-color-${p.tone})` : paletteColor(index)))
}

/** A color given as a CSS color or a tone name, as the canvas takes it. */
const itemColor = (color: string) => resolveColor(toneOrColor(color))

/** The colors of single bars or points, by row, when `color` is a function. */
function itemColors(s: ChartSeries): Array<string | undefined> | null {
  const of = s.props.color
  if (typeof of !== 'function') return null
  const out: Array<string | undefined> = []
  // a few colors for many rows: each worked out once
  const seen = new Map<string, string>()
  for (let i = 0; i < s.y.length; i++) {
    const color = of(rowOf(s.rows, i), i)
    if (!color) {
      out.push(undefined)
      continue
    }
    let css = seen.get(color)
    if (css === undefined) seen.set(color, (css = itemColor(color)))
    out.push(css)
  }
  return out
}

const series = computed<ChartSeries[]>(() => {
  void themeVersion.value
  return model.value.series.map((s) => {
    const { props: p, index } = s.input
    const shown: ChartSeries = {
      ...s,
      index,
      kind: s.input.kind,
      props: p,
      color: seriesColor(p, index),
    }
    shown.colors = itemColors(shown)
    return shown
  })
})

/** The colored part of the palette: slices leave the neutral first color for "other". */
const SLICE_COLORS = 7

const sliceColors = computed(() => {
  void themeVersion.value
  const palette = ownPalette.value
  return slices.value.map((slice) => {
    const own = slice.color
    // `neutral` is the palette's own gray, softer than the neutral tone; a
    // palette of the chart's own is taken in order, its first color too
    const css = own
      ? toneOrColor(own)
      : palette
        ? toneOrColor(palette[slice.index % palette.length]!)
        : `var(--dou-color-chart-${(slice.index % SLICE_COLORS) + 2})`
    return resolveColor(css)
  })
})

if (process.env.NODE_ENV !== 'production')
  watch(slices, (list) => {
    const count = ownPalette.value?.length ?? SLICE_COLORS
    if (list.length > count && pie.value && pie.value.props.color === undefined)
      console.warn(
        `[@dou-ui/chart] a pie of ${list.length} slices repeats colors after ${count}: merge the small ones into one slice, or give each a \`color\`.`,
      )
  })

/** The legend: one entry per series, or per slice of a pie, turned off or not. */
const legendEntries = computed(() => {
  if (empty.value) return []
  void themeVersion.value
  if (pie.value) {
    if (!(props.legend ?? slices.value.length > 1)) return []
    const last = shownSlices.value.length === 1
    return slices.value.map((slice, k) => ({
      text: slice.label,
      color: sliceColors.value[k]!,
      kind: 'pie',
      dashed: false,
      off: slice.hidden,
      locked: last && !slice.hidden,
    }))
  }
  if (!(props.legend ?? seriesParts.value.length > 1)) return []
  const last = seriesParts.value.filter((part) => !part.hidden.value).length === 1
  return seriesParts.value.map((part, index) => ({
    text: seriesName({ index, props: part.props }),
    color: seriesColor(part.props, index),
    kind: part.kind.type,
    dashed: !!part.props.dashed,
    off: part.hidden.value,
    // the last one shown can't be turned off
    locked: last && !part.hidden.value,
  }))
})

/** Turns an entry's series (or slice) on or off; the last one shown stays on. */
function toggle(index: number) {
  const pieChart = pie.value
  if (pieChart) {
    const slice = slices.value[index]
    if (!slice) return
    const hidden = pieChart.hidden.value
    if (slice.hidden) pieChart.hidden.value = hidden.filter((label) => label !== slice.label)
    else if (shownSlices.value.length > 1) pieChart.hidden.value = [...hidden, slice.label]
  } else {
    const part = seriesParts.value[index]
    if (!part) return
    if (part.hidden.value) part.hidden.value = false
    else if (seriesParts.value.filter((p) => !p.hidden.value).length > 1) part.hidden.value = true
  }
  if (focused.value === index) focused.value = null
}

/** The legend entry the pointer or focus is on: its series is brought forward. */
const focused = ref<number | null>(null)

/**
 * Shows only the entry's series (or slice), or all of them again when it
 * already is the only one: its legend entry clicked with Alt, held down on
 * a touch screen, or Alt+Enter.
 */
function isolate(index: number) {
  const pieChart = pie.value
  if (pieChart) {
    const slice = slices.value[index]
    if (!slice) return
    const alone = shownSlices.value.length === 1 && !slice.hidden
    pieChart.hidden.value = alone
      ? []
      : slices.value.filter((other) => other !== slice).map((other) => other.label)
  } else {
    const parts = seriesParts.value
    const part = parts[index]
    if (!part) return
    const alone = !part.hidden.value && parts.every((p) => p === part || p.hidden.value)
    for (const p of parts) p.hidden.value = alone ? false : p !== part
  }
  focused.value = null
}

/* zoom: the stretch of x (and of the values) shown */

const zoomPart = computed(() => (!pie.value && zoomParts.value[0]) || null)
const rangePart = computed(() => (!pie.value && rangeParts.value[0]) || null)
const brushPart = computed(() => {
  const part = brushParts.value[0]
  return !pie.value && part && !part.props.disabled ? part : null
})
/** Whether the chart zooms with the wheel, fingers and keys. */
const zoomOn = computed(() => !!zoomPart.value && !zoomPart.value.props.disabled && !empty.value)
const zoomAxes = computed(() => {
  const axis = zoomPart.value?.props.axis ?? 'x'
  return { x: zoomOn.value && axis !== 'y', y: zoomOn.value && axis !== 'x' }
})

/** The models the stretch of x is kept in: the zoom's and the strip's. */
const xModels = computed(() => {
  const list: Array<IntervalRef> = []
  if (zoomPart.value && !zoomPart.value.props.disabled) list.push(zoomPart.value.x)
  if (rangePart.value) list.push(rangePart.value.x)
  return list
})
type IntervalRef = ZoomPart['x']

/**
 * The windows shown, in the scales' own numbers. Kept here rather than
 * read from the models each time: a drag over categories moves smoothly
 * through parts of them, while the models get whole categories.
 */
const xWindow = shallowRef<Window | null>(null)
const yWindow = shallowRef<Window | null>(null)
/** What was last given to the models, to tell it from a value set by the page. */
let sentX: unknown = null
let sentY: unknown = null

watch(
  () => [xModels.value[0]?.value, model.value] as const,
  ([value]) => {
    const raw = value ? toRaw(value) : null
    if (raw === sentX && raw !== null) return
    const m = model.value
    xWindow.value = intervalToWindow(raw, m.xKind, m.categories)
  },
  { immediate: true },
)

watch(
  () => (zoomAxes.value.y ? zoomPart.value?.y.value : null),
  (value) => {
    const raw = value ? toRaw(value) : null
    if (raw === sentY && raw !== null) return
    yWindow.value = intervalToWindow(raw, 'linear', [])
  },
  { immediate: true },
)

/** The y axis that zooming the values follows: `y`, or `y2` when it is alone. */
const primaryY = (l: ChartLayout) => l.y.y ?? l.y.y2

/** The least that can be shown: one category, a few of the closest x values, a thousandth of the values. */
const leastX = computed(() => {
  const m = model.value
  if (m.xKind === 'category') return 1
  let gap = Infinity
  for (const s of m.series) {
    const g = smallestGap(s.x.values)
    if (g < gap) gap = g
  }
  const span = m.x ? m.x[1] - m.x[0] : 1
  return gap < Infinity ? gap * 4 : span / 1000
})

const sameInterval = (a: ChartInterval | null, b: ChartInterval | null | undefined) =>
  a === b ||
  (!!a && !!b && a.every((v, i) => +v === +b[i]! || (v === b[i] && typeof v === 'string')))

/** Shows `window` of x (`null` for all of it); `settle` moves a drag over categories to whole ones. */
function showX(window: Window | null, settle = false) {
  const l = layout.value
  if (!l) return
  const m = model.value
  const category = m.xKind === 'category'
  let next = window && clampWindow(window, l.x.full, leastX.value)
  if (next && settle && category) next = clampWindow(snapCategories(next), l.x.full, 1)
  xWindow.value = next
  let interval = next ? windowToInterval(next, m.xKind, m.categories) : null
  if (interval && next && m.xKind === 'linear') interval = rounded(next)
  // a model the page hasn't updated yet still holds what it had: compare with what was sent too
  const last = sentX as ChartInterval | null
  for (const kept of xModels.value) {
    if (sameInterval(interval, kept.value) && sameInterval(interval, last)) continue
    sentX = interval
    kept.value = interval
  }
}

/** Shows `window` of the values (on `y`, or `y2` alone); `null` for all of them. */
function showY(window: Window | null) {
  const l = layout.value
  const axis = l && primaryY(l)
  const part = zoomPart.value
  if (!axis || !part) return
  const units = unitsOf(axis.scale)
  const span = units.to(axis.full[1]) - units.to(axis.full[0])
  const next = window && clampWindow(window, axis.full, span / 1000, units)
  yWindow.value = next
  const interval: ChartInterval | null = next ? rounded(next) : null
  if (sameInterval(interval, part.y.value) && sameInterval(interval, sentY as ChartInterval | null))
    return
  sentY = interval
  part.y.value = interval
}

/** A window of numbers as given back: a thousandth of its span is as fine as it gets, not 62.1344726775542. */
function rounded([a, b]: Window): [number, number] {
  const span = Math.abs(b - a)
  const digits = span > 0 ? Math.min(12, Math.max(0, Math.ceil(-Math.log10(span / 1000)))) : 0
  return [Number(a.toFixed(digits)), Number(b.toFixed(digits))]
}

const zoomed = computed(() => !!xWindow.value || !!yWindow.value)

/** Where a point is along x, and along the values, in px. */
const alongX = ([px, py]: [number, number]) => (props.horizontal ? py : px)
const alongY = ([px, py]: [number, number]) => (props.horizontal ? px : py)

/** A scale like `like` over `window`. */
function scaleOver(window: Window, like: Scale): Scale {
  if (like.kind === 'log') return logScale(window, like.range)
  return linearScale(window, like.range)
}

interface Scales {
  x: Scale
  y: Scale | null
}

function scalesNow(): Scales | null {
  const l = layout.value
  return l && { x: l.x.scale, y: primaryY(l)?.scale ?? null }
}

/** Zooms by `factor` (below 1 is in) about `at`; from `from`, the scales as they were. */
function zoomBy(factor: number, at: [number, number], from = scalesNow()) {
  if (!from) return
  if (zoomAxes.value.x) showX(zoomWindow(from.x, alongX(at), factor))
  if (zoomAxes.value.y && from.y) showY(zoomWindow(from.y, alongY(at), factor))
}

/** Moves what is shown with a drag of `by` px; from `from`, the scales as the drag started. */
function panBy(by: [number, number], from = scalesNow()) {
  if (!from) return
  if (zoomAxes.value.x && xWindow.value) showX(panWindow(from.x, -alongX(by)))
  if (zoomAxes.value.y && yWindow.value && from.y) showY(panWindow(from.y, -alongY(by)))
}

function resetZoom(announce = false) {
  if (!zoomed.value) return
  showX(null)
  if (zoomPart.value) showY(null)
  if (announce) zoomNote.value = messages.value.zoomReset
}

/** Read out after zooming with the keys. */
const zoomNote = ref('')

/** Below this width, a legend down the right side goes under the chart: it would leave the plot too narrow. */
const LEGEND_SIDE_LEAST = 480
/** Where the legend goes: as asked, else under the chart. */
const legendPlacement = computed<ChartLegendPlacement>(() => {
  const asked = props.legendPlacement ?? 'bottom'
  return asked === 'right' && size.width.value && size.width.value < LEGEND_SIDE_LEAST
    ? 'bottom'
    : asked
})

const layout = computed(() => {
  const width = size.width.value
  const height = size.height.value
  if (!width || !height || pie.value) return null
  void themeVersion.value
  return layoutChart({
    model: model.value,
    axes: axes.value,
    horizontal: props.horizontal,
    width,
    height,
    locale: locale.value.name,
    measure,
    legend: legendEntries.value.map((entry) => entry.text),
    coarse: coarse.value,
    legendPlacement: legendPlacement.value,
    zoom: { x: xWindow.value, y: zoomAxes.value.y ? yWindow.value : null },
    strip: !!rangePart.value && !empty.value,
    trailing: endLabelRoom.value,
  })
})

const pieLayout = computed(() => {
  const width = size.width.value
  const height = size.height.value
  if (!width || !height || !pie.value) return null
  void themeVersion.value
  return layoutPie({
    width,
    height,
    measure,
    legend: legendEntries.value.map((entry) => entry.text),
    coarse: coarse.value,
    legendPlacement: legendPlacement.value,
    sideLabels: pieLabelsOutside.value ? pieSideWidths.value : undefined,
  })
})

/* markers: lines, bands and points written into the chart */

/** A marker's x as a number on the x scale: one, or the two ends of a band; `undefined` when it can't be read. */
function markerX(x: ChartMarkerProps['x']): MarkerInput['x'] | undefined {
  if (x === undefined || x === null) return null
  const m = model.value
  if (Array.isArray(x)) {
    const [a, b] = x as ChartInterval
    // a band of one category, or of one time, is that category or time
    if (
      m.xKind !== 'category' &&
      valueToNumber(a, m.xKind, m.categories) === valueToNumber(b, m.xKind, m.categories)
    )
      return markerX(a)
    return intervalToWindow(x as ChartInterval, m.xKind, m.categories) ?? undefined
  }
  const at = valueToNumber(x as ChartTickValue, m.xKind, m.categories)
  return at === at ? at : undefined
}

const placedMarkers = computed(() => {
  const l = layout.value
  if (!l || empty.value || !markerParts.value.length) return []
  const inputs: MarkerInput[] = []
  for (const part of markerParts.value) {
    const p = part.props
    const x = markerX(p.x)
    if (x === undefined) continue
    inputs.push({
      x,
      y: p.y ?? null,
      axis: p.axis ?? defaultAxis.value,
      label: p.label,
      tone: p.tone ?? 'neutral',
      solid: p.dashed === false,
    })
  }
  return placeMarkers(inputs, {
    plot: l.plot,
    x: l.x.scale,
    y: (axis) => l.y[axis]?.scale ?? null,
    horizontal: !!props.horizontal,
    measure,
  })
})

/** The markers' labels, as text over the chart. */
const markerLabels = computed(() =>
  placedMarkers.value.flatMap((marker, i) =>
    marker.label
      ? [
          {
            ...marker.label,
            key: `marker:${i}`,
            tone: marker.tone,
            // it may be over the data: on a chip to stay readable
            backdrop: true,
          },
        ]
      : [],
  ),
)

/* data labels: values written by the points and on the bars */

type LabelProps = {
  labels?: boolean | ChartLabelFormat
  labelPosition?: string
  lineWidth?: number
  dots?: boolean | 'auto'
}

/** The text of a data label, or `null` for none. */
function labelText(s: ChartSeries, row: number): string | null {
  const given = (s.props as LabelProps).labels
  const value = s.y[row]!
  if (value !== value) return null
  const share =
    s.stackEnds && declaredAxes.value[s.axis]?.percent
      ? Math.abs(s.top[row]! - s.base![row]!)
      : undefined
  if (typeof given === 'function') {
    const text = given({
      value,
      share,
      low: s.base && !s.stackEnds ? s.base[row] : undefined,
      name: s.name,
      row: rowOf(s.rows, row),
      index: row,
    })
    return text == null || text === '' ? null : String(text)
  }
  // a share, with a decimal as in the tooltip, unless the axis writes its own
  if (share !== undefined) {
    const own = declaredAxes.value[s.axis]?.format
    return own ? own(share) : percent.value.format(share)
  }
  return valueText(s.axis)(value)
}

/** Series with labels at the end of their line: the room they need past the plot, in px. */
const endLabelRoom = computed(() => {
  if (pie.value || props.horizontal) return 0
  let widest = 0
  for (const part of seriesParts.value) {
    const p = part.props as LabelProps
    if (!p.labels || p.labelPosition !== 'end' || part.hidden.value) continue
    const s = series.value.find((x) => x.props === part.props)
    if (!s) continue
    for (let i = s.y.length - 1; i >= 0; i--) {
      const text = s.y[i] === s.y[i] ? labelText(s, i) : null
      if (text === null) continue
      widest = Math.max(widest, measure(text))
      break
    }
  }
  return widest ? Math.ceil(widest) + 8 : 0
})

/* a pie's labels */

/** The most of the chart's width a pie's labels outside may take, each side. */
const PIE_LABEL_SHARE = 0.26

/**
 * The smallest a pie gets to keep its labels outside: a share of its size
 * without them, or a radius in px that still reads. Smaller, they go inside.
 */
const PIE_LEAST = 0.6
const PIE_LEAST_RADIUS = 48

/** Each slice's label: its own text, given by a function; else its name and share. `null` for none. */
const pieLabelParts = computed<Array<{ text?: string; name: string; share: string } | null>>(() => {
  const part = pie.value
  const given = part?.props.labels
  if (!part || !given) return []
  return slices.value.map((slice) => {
    if (slice.hidden) return null
    const share = percent.value.format(slice.share)
    if (typeof given !== 'function') return { name: slice.label, share }
    const text = given({
      value: slice.value,
      share: slice.share,
      name: slice.label,
      row: rowOf(part.props.data ?? props.data, slice.index),
      index: slice.index,
    })
    return text == null || text === '' ? null : { text: String(text), name: slice.label, share }
  })
})

const outsideText = (p: { text?: string; name: string; share: string }) =>
  p.text ?? `${p.name} ${p.share}`

/** Which side of the pie a slice's label goes, outside it. */
const sideOf = (slice: { start: number; end: number }) =>
  Math.sin((slice.start + slice.end) / 2) >= 0 ? 'right' : 'left'

/** The widest label outside the pie on each side, at most a share of the chart's width. */
const pieSideWidths = computed(() => {
  const widths = { left: 0, right: 0 }
  const cap = size.width.value * PIE_LABEL_SHARE
  slices.value.forEach((slice, k) => {
    const p = pieLabelParts.value[k]
    if (!p || !(slice.end > slice.start)) return
    const side = sideOf(slice)
    widths[side] = Math.max(widths[side], Math.ceil(Math.min(cap, measure(outsideText(p)))))
  })
  return widths
})

/**
 * Whether the pie's labels go outside it: as asked (the default), unless
 * the room they take would leave the pie too small; then inside, where
 * slices fit them.
 */
const pieLabelsOutside = computed(() => {
  const part = pie.value
  if (!part?.props.labels || (part.props.labelPosition ?? 'outside') !== 'outside') return false
  const width = size.width.value
  const height = size.height.value
  if (!width || !height) return true
  void themeVersion.value
  const base = {
    width,
    height,
    measure,
    legend: legendEntries.value.map((entry) => entry.text),
    coarse: coarse.value,
    legendPlacement: legendPlacement.value,
  }
  const alone = layoutPie(base).radius
  const radius = layoutPie({ ...base, sideLabels: pieSideWidths.value }).radius
  return radius >= Math.min(alone * PIE_LEAST, PIE_LEAST_RADIUS)
})

/** Each slice's label text, by its place in `slices`; `null` for none. */
const pieTexts = computed<Array<string | null>>(() => {
  const outside = pieLabelsOutside.value
  return pieLabelParts.value.map((p) =>
    !p ? null : outside ? outsideText(p) : (p.text ?? p.share),
  )
})

/** A line from a slice out to its label, in px. */
type Leader = Array<[number, number]>

/** The pie's labels, and the lines out to those outside it. */
const pieLabels = computed(() => {
  const l = pieLayout.value
  const texts = pieTexts.value
  const out: {
    labels: Array<PlacedDataLabel & { ink?: string; width?: number; full?: string }>
    leaders: Leader[]
  } = {
    labels: [],
    leaders: [],
  }
  if (!l || !texts.length || empty.value) return out
  void themeVersion.value
  const { cx, cy, radius } = l
  const list = slices.value
  if (!pieLabelsOutside.value) {
    // in each slice, in the middle of its ring: where it fits
    const inner = radius * holeRatio.value
    const at = inner > 0 ? (radius + inner) / 2 : radius * 0.62
    const thickness = radius - inner
    list.forEach((slice, k) => {
      const text = texts[k]
      if (!text || !(slice.end > slice.start)) return
      const width = measure(text)
      const arc = (slice.end - slice.start) * at
      if (arc < width + 8 || thickness < DATA_LABEL + 4) return
      const middle = (slice.start + slice.end) / 2
      out.labels.push({
        key: `slice:${slice.index}`,
        series: -1,
        text,
        left: cx + Math.sin(middle) * at,
        top: cy - Math.cos(middle) * at - DATA_LABEL / 2,
        align: 'middle',
        on: sliceColors.value[k],
        ink: inkOn(sliceColors.value[k]!),
      })
    })
    return out
  }
  // outside: a column of labels either side, each joined to its slice by a line
  const widths = pieSideWidths.value
  // the pie's own room, above the legend, less a little at the edges
  const room = { top: EDGE_ROOM, bottom: cy * 2 - EDGE_ROOM }
  const sides: Record<'left' | 'right', Array<{ k: number; y: number; middle: number }>> = {
    left: [],
    right: [],
  }
  list.forEach((slice, k) => {
    if (!texts[k] || !(slice.end > slice.start)) return
    const middle = (slice.start + slice.end) / 2
    const side = sideOf(slice)
    sides[side].push({ k, y: cy - Math.cos(middle) * (radius + 10), middle })
  })
  const capacity = Math.max(1, Math.floor((room.bottom - room.top) / DATA_LABEL))
  for (const side of ['left', 'right'] as const) {
    let items = sides[side]
    // too many to fit: the smallest slices go without
    if (items.length > capacity) {
      const kept = [...items]
      kept.sort((a, b) => list[b.k]!.share - list[a.k]!.share)
      const keep = new Set(kept.slice(0, capacity))
      items = items.filter((item) => keep.has(item))
    }
    const centers = spread(
      items.map((item) => item.y),
      DATA_LABEL,
      room.top,
      room.bottom,
    )
    const right = side === 'right'
    const widest = widths[side]
    const column = right ? cx + radius + PIE_LABEL_ROOM : cx - radius - PIE_LABEL_ROOM
    items.forEach((item, n) => {
      const y = centers[n]!
      const sin = Math.sin(item.middle)
      const cos = Math.cos(item.middle)
      // out from the slice to the label's height, then straight across to it; the
      // turn stays clear of the pie, so the line across doesn't run over it
      const end = column + (right ? -4 : 4)
      const clear = Math.sqrt(Math.max(0, (radius + 8) ** 2 - (y - cy) ** 2))
      const reach = Math.max(Math.abs(sin) * (radius + 10), clear)
      const turn = right ? Math.min(cx + reach, end) : Math.max(cx - reach, end)
      out.leaders.push([
        [cx + sin * (radius + 2), cy - cos * (radius + 2)],
        [turn, y],
        [end, y],
      ])
      const text = texts[item.k]!
      const parts = pieLabelParts.value[item.k]!
      const long = measure(text) > widest + 0.5
      // longer than there is room for: the name is cut short, so the share still shows
      const fitted =
        long && parts.text === undefined
          ? `${fitText(parts.name, widest - measure(` ${parts.share}`))} ${parts.share}`
          : text
      const cut = long && fitted === text
      out.labels.push({
        key: `slice:${list[item.k]!.index}`,
        series: -1,
        text: fitted,
        left: column,
        top: y - DATA_LABEL / 2,
        align: right ? 'start' : 'end',
        width: cut ? widest : undefined,
        full: fitted === text ? undefined : text,
      })
    })
  }
  return out
})

/** Room kept clear at the chart's top and bottom edges, in px. */
const EDGE_ROOM = 4

/** Whether data labels show: not before the chart is first drawn, nor while it comes in. */
const labelsShown = ref(false)

/** The data labels, placed: the ends of lines first, then the bars', then the points'. */
const dataLabels = computed<
  Array<PlacedDataLabel & { ink?: string; width?: number; full?: string }>
>(() => {
  if (pie.value) return pieLabels.value.labels
  const l = layout.value
  if (!l || empty.value) return []
  void themeVersion.value
  const { plot } = l
  const bounds: Rect = {
    x: plot.x - 4,
    y: plot.y - 4,
    width: plot.width + 8,
    height: plot.height + 8,
  }
  const ends: Array<{ input: DataLabelInput; s: ChartSeries }> = []
  const bars: DataLabelInput[] = []
  const points: DataLabelInput[] = []
  for (const s of series.value) {
    const p = s.props as LabelProps
    if (!p.labels || !s.kind.labels) continue
    const view = viewOf(s)
    if (!view) continue
    const lineWidth = p.lineWidth ?? 2
    // past the dot, when there is one
    const offset = s.kind.band ? 0 : Math.max(2.5, lineWidth + 0.5)
    // above: a cap on how many, for a chart of very many points
    for (const anchor of s.kind.labels(s, view).slice(0, 1000)) {
      const text = labelText(s, anchor.index)
      if (text === null) continue
      const input: DataLabelInput = {
        key: `${s.index}:${anchor.index}`,
        series: s.index,
        text,
        anchor,
        offset,
      }
      if (p.labelPosition === 'end') ends.push({ input, s })
      else if (s.kind.band) bars.push(input)
      else points.push(input)
    }
  }
  const taken: Array<[number, number, number, number]> = []
  const out: Array<PlacedDataLabel & { ink?: string }> = []
  if (ends.length) {
    // each line keeps its label: moved apart rather than left out
    const centers = spread(
      ends.map((e) => e.input.anchor.at[1]),
      DATA_LABEL,
      plot.y - 4,
      plot.y + plot.height + 4,
    )
    ends.forEach(({ input, s }, k) => {
      const left = input.anchor.at[0] + 4 + (input.offset ?? 0)
      const top = centers[k]! - DATA_LABEL / 2
      taken.push([left, top, left + measure(input.text), top + DATA_LABEL])
      out.push({
        key: input.key,
        series: s.index,
        text: input.text,
        left,
        top,
        align: 'start',
        ink: s.color,
      })
    })
  }
  for (const label of placeDataLabels(bars, bounds, measure, taken))
    out.push({ ...label, ink: label.on && inkOn(label.on) })
  out.push(...placeDataLabels(points, bounds, measure, taken))
  return out
})

/** Text that reads on a bar of `color`: the page's text color or its surface, whichever stands out more. */
function inkOn(color: string): string {
  const bar = luminance(resolveColor(color))
  const text = luminance(resolveColor('var(--dou-color-text)'))
  const surface = luminance(resolveColor('var(--dou-chart-surface)'))
  if (bar === null || text === null || surface === null) return 'var(--dou-color-text)'
  return contrast(bar, text) >= contrast(bar, surface)
    ? 'var(--dou-color-text)'
    : 'var(--dou-chart-surface)'
}

const markerText = (tone: Tone) =>
  tone === 'neutral' ? 'var(--dou-color-text-secondary)' : `var(--dou-color-${tone}-text)`

const markerColors = computed(() => {
  void themeVersion.value
  const surface = colors.value.surface
  const of = (line: string, dot: string, fill: string): MarkerColors => ({
    line: resolveColor(line),
    dot: resolveColor(dot),
    fill: resolveColor(fill),
    surface,
  })
  const tone = (name: string) =>
    of(
      `var(--dou-color-${name})`,
      `var(--dou-color-${name})`,
      `color-mix(in oklab, var(--dou-color-${name}) 10%, transparent)`,
    )
  return {
    neutral: of(
      'var(--dou-chart-marker)',
      'var(--dou-color-text-secondary)',
      'color-mix(in oklab, var(--dou-color-text) 5%, transparent)',
    ),
    primary: tone('primary'),
    success: tone('success'),
    warning: tone('warning'),
    danger: tone('danger'),
  } satisfies Record<Tone, MarkerColors>
})

/* the tooltip: what is under the pointer, or picked with the keys */

const tooltipPart = computed(() => tooltipParts.value[0] ?? null)
/** Whether the chart follows the pointer and can be focused. */
const interactive = computed(
  () => !tooltipPart.value?.props.disabled && !empty.value && !props.table,
)
const trigger = computed(
  () =>
    tooltipPart.value?.props.trigger ??
    (pie.value || series.value.some((s) => s.kind.tooltip === 'item') ? 'item' : 'axis'),
)

/** An x (with every series at it), one point of a series, or a slice. */
type Target =
  | { type: 'axis'; x: number }
  | { type: 'item'; series: number; row: number; radius: number }
  | { type: 'slice'; slice: number }

type Active = Target & {
  /** Where the pointer is; `null` when picked with the keys. */
  pointer: [number, number] | null
  /** Picked with a finger: the tooltip goes above it, where the hand doesn't cover it. */
  touch?: boolean
  /** Shown because another chart of the tooltip's `group` points at this x. */
  synced?: boolean
}

const active = shallowRef<Active | null>(null)

/** What is under `(px, py)`, in px from the chart's top left. */
function hitAt(px: number, py: number): Target | null {
  const p = pieLayout.value
  if (p) {
    const r = Math.hypot(px - p.cx, py - p.cy)
    if (r > p.radius || r < p.radius * holeRatio.value) return null
    const angle = angleAt(p.cx, p.cy, px, py)
    const k = slices.value.findIndex((s) => !s.hidden && angle >= s.start && angle < s.end)
    return k < 0 ? null : { type: 'slice', slice: k }
  }
  const l = layout.value
  if (!l) return null
  const { plot } = l
  // a little room around the plot, for points on its edge
  const room = trigger.value === 'item' ? 8 : 0
  if (px < plot.x - room || px > plot.x + plot.width + room) return null
  if (py < plot.y - room || py > plot.y + plot.height + room) return null
  if (trigger.value === 'axis') {
    const along = props.horizontal ? py : px
    const x = nearestX(
      series.value.map((s) => s.x.values),
      l.x.scale,
      along,
    )
    // zoomed in: only what is shown
    if (x === null) return null
    const at = l.x.scale.map(x)
    const [r0, r1] = l.x.scale.range
    return at < Math.min(r0, r1) - 0.5 || at > Math.max(r0, r1) + 0.5 ? null : { type: 'axis', x }
  }
  // the series drawn last is on top
  for (let k = series.value.length - 1; k >= 0; k--) {
    const s = series.value[k]!
    const view = viewOf(s)
    if (!view) continue
    const hit = s.kind.hit ? s.kind.hit(s, view, px, py) : nearestOf(s, view, px, py)
    if (!hit) continue
    // zoomed in: a point cut off at the plot's edge can't be picked
    const [left, top] = view.point(s.x.values[hit.index]!, s.top[hit.index]!)
    if (left < plot.x - 4 || left > plot.x + plot.width + 4) continue
    if (top < plot.y - 4 || top > plot.y + plot.height + 4) continue
    return { type: 'item', series: s.index, row: hit.index, radius: hit.radius }
  }
  return null
}

/** How near a line the pointer comes before its series is brought forward, in px. */
const NEAR_LINE = 8

/**
 * The series under the pointer, brought forward while the tooltip shows
 * all of them: the line it is near, or the bar or area it is over. A
 * point picked on its own (a scatter's) brings its series forward too.
 * `null` with a single series, or none under the pointer.
 */
const pointed = computed<number | null>(() => {
  const a = active.value
  if (!a?.pointer || pie.value || series.value.length < 2) return null
  if (a.type === 'item') return a.series
  if (a.type !== 'axis') return null
  const along = alongX(a.pointer)
  const value = alongY(a.pointer)
  let near: { index: number; distance: number } | null = null
  let over: number | null = null
  for (const s of series.value) {
    const row = rowAt(s.x.values, a.x)
    const view = row < 0 ? null : viewOf(s)
    const top = view ? s.top[row]! : Number.NaN
    if (!view || top !== top) continue
    const end = alongY(view.point(a.x, top))
    if (s.kind.band) {
      const { offset, width } = barPlacement(view.band, s.slot)
      const u = view.x.map(a.x) + offset
      const start = s.base ? view.y.map(s.base[row]!) : baseline(view.y)
      if (
        along >= u &&
        along <= u + width &&
        value >= Math.min(start, end) &&
        value <= Math.max(start, end)
      )
        over = s.index
      continue
    }
    const distance = Math.abs(value - end)
    if (distance <= NEAR_LINE && (!near || distance < near.distance))
      near = { index: s.index, distance }
    // an area: over it, between its bottom and its top
    if (s.kind.zero && !s.kind.band) {
      const start = s.base ? view.y.map(s.base[row]!) : baseline(view.y)
      if (value >= Math.min(start, end) && value <= Math.max(start, end)) over = s.index
    }
  }
  return near?.index ?? over
})

/** The point of `s` nearest to `(px, py)`, within 12px. */
function nearestOf(s: ChartSeries, view: ChartView, px: number, py: number): ChartHit | null {
  const xs = s.x.values
  const hit = nearestPoint(
    Math.min(xs.length, s.top.length),
    (i) => (xs[i] === xs[i] && s.top[i] === s.top[i] ? view.point(xs[i]!, s.top[i]!) : null),
    px,
    py,
    () => 12,
  )
  return hit && { index: hit.index, radius: 4 }
}

const percent = computed(
  () => new Intl.NumberFormat(locale.value.name, { style: 'percent', maximumFractionDigits: 1 }),
)

/** What is shown for the active x, point or slice. */
const tip = computed<Tip | null>(() => {
  if (!interactive.value) return null
  const t = tipOf(active.value)
  return t && active.value?.touch ? { ...t, above: true } : t
})

function tipOf(a: Active | null): Tip | null {
  if (!a) return null
  if (a.type === 'slice') {
    const p = pieLayout.value
    const slice = slices.value[a.slice]
    if (!p || !slice || slice.hidden) return null
    const middle = (slice.start + slice.end) / 2
    const at = p.radius * (holeRatio.value > 0 ? (1 + holeRatio.value) / 2 : 0.6)
    const off = slices.value.length - shownSlices.value.length
    return {
      x: slice.label,
      note: off ? format(messages.value.hiddenSlices, { count: off }) : undefined,
      items: [
        {
          name: slice.label,
          text: format(messages.value.share, {
            value: numberFormatFull(locale.value.name)(slice.value),
            share: percent.value.format(slice.share),
          }),
          value: slice.value,
          color: sliceColors.value[a.slice],
          row: rowOf(pie.value!.props.data ?? props.data, slice.index),
        },
      ],
      anchor: a.pointer ?? [p.cx + Math.sin(middle) * at, p.cy - Math.cos(middle) * at],
      marks: [],
    }
  }
  const l = layout.value
  if (!l) return null
  const { plot } = l
  const horizontal = !!props.horizontal
  if (a.type === 'item') {
    const s = series.value.find((x) => x.index === a.series)
    const view = s && viewOf(s)
    if (!s || !view) return null
    const x = s.x.values[a.row]!
    const y = s.y[a.row]!
    if (x !== x || y !== y) return null
    const [left, top] = view.point(x, s.top[a.row]!)
    const items: ChartTooltipItem[] = [
      { name: axes.value.x.title ?? 'x', text: xText(x), value: m0x() ? x : undefined },
      {
        name: axes.value[s.axis]?.title ?? (s.axis === 'y2' ? 'y2' : 'y'),
        text: seriesText(s, a.row),
        value: y,
        color: s.colors?.[a.row] ?? s.color,
      },
    ]
    const sizeOf = s.props.size as ChartAccessor | undefined
    if (sizeOf !== undefined) {
      const value = Number(read(rowOf(s.rows, a.row), sizeOf, a.row))
      const name =
        (s.props.sizeName as string | undefined) ?? (typeof sizeOf === 'string' ? sizeOf : '')
      if (value === value)
        items.push({ name, text: numberFormatFull(locale.value.name)(value), value })
    }
    for (const item of items) item.row = rowOf(s.rows, a.row)
    // a point with a name of its own (a city) is titled by it
    const label = s.props.label as ChartAccessor | undefined
    const own = label === undefined ? null : read(rowOf(s.rows, a.row), label, a.row)
    return {
      x: rawX(x),
      title: own == null || own === '' ? s.name : String(own),
      items,
      anchor: [left, top],
      marks: [{ left, top, color: s.colors?.[a.row] ?? s.color, radius: a.radius + 3, ring: true }],
    }
  }
  // every series at one x
  const x = a.x
  const at = l.x.scale.map(x)
  const items: ChartTooltipItem[] = []
  /** The series under the pointer, brought forward. */
  const under = pointed.value
  /** The series of each item. */
  const owners: number[] = []
  const marks: Tip['marks'] = []
  let band = false
  for (const s of series.value) {
    const row = rowAt(s.x.values, x)
    const view = viewOf(s)
    if (row < 0 || !view) continue
    const y = s.y[row]!
    if (y !== y) continue
    items.push({
      name: s.name,
      text: seriesText(s, row),
      value: y,
      color: s.colors?.[row] ?? s.color,
      row: rowOf(s.rows, row),
    })
    owners.push(s.index)
    if (s.kind.band) band = true
    else {
      const [left, top] = view.point(x, s.top[row]!)
      marks.push({
        left,
        top,
        color: s.colors?.[row] ?? s.color,
        radius: 4,
        ring: false,
        faded: under !== null && s.index !== under,
      })
    }
  }
  if (!items.length) return null
  if (under !== null && items.length > 1)
    for (let k = 0; k < owners.length; k++) if (owners[k] === under) items[k]!.active = true
  const crosshair = tooltipPart.value?.props.crosshair ?? true
  const room = band ? (viewOf(series.value[0]!)?.band ?? 0) : 1
  const across = (start: number, length: number): Rect =>
    horizontal
      ? { x: plot.x, y: start, width: plot.width, height: length }
      : { x: start, y: plot.y, width: length, height: plot.height }
  const dpr = dprNow()
  const line = crisp(at, dpr) - 0.5
  // with the keys: beside the highest point, or the middle of the plot
  let anchor = a.pointer
  if (!anchor) {
    if (horizontal) {
      const right = marks.length ? Math.max(...marks.map((m) => m.left)) : plot.x + plot.width / 2
      anchor = [right, at]
    } else {
      const top = marks.length ? Math.min(...marks.map((m) => m.top)) : plot.y + plot.height / 2
      anchor = [at, top]
    }
  }
  // a finger on the screen: beside the x, clear of its bars and the hand
  const width = band ? room : 24
  return {
    x: rawX(x),
    title: xText(x),
    items,
    focused: items.some((item) => item.active),
    anchor,
    clear: a.touch ? across(at - width / 2, width) : undefined,
    marks,
    band: crosshair && band ? across(at - room / 2, room) : undefined,
    line: crosshair && !band ? across(line, 1) : undefined,
  }
}

/** An x as given: the category, a `Date` on a time axis, or the number. */
function rawX(x: number): unknown {
  const kind = model.value.xKind
  return kind === 'category' ? model.value.categories[x] : kind === 'time' ? new Date(x) : x
}

/** Tells the page what was picked: what the tooltip shows there. */
function select(t: Tip) {
  emit('select', { x: t.x, title: t.title, items: t.items })
}

/** Whether anyone listens to `select`: then what can be picked shows a pointing hand. */
const selectable = () => !!instance?.vnode.props?.onSelect

function onClick(event: MouseEvent) {
  // the legend's own buttons
  if ((event.target as Element).closest?.('button')) return
  if (dragged) {
    dragged = false
    return
  }
  const at = local(event)
  // a click beside the selection lets it go
  const kept = selection.value
  if (kept && inPlot(at) && !inRect(at, kept)) clearBrush()
  const target = hitAt(...at)
  const t = target && tipOf({ ...target, pointer: at })
  if (t) select(t)
}

watch(active, (a) => {
  const root = rootRef.value
  if (root && selectable()) root.style.cursor = a?.pointer && !a.touch ? 'pointer' : ''
})

/** Whether x is a number worth giving as `value` (not a category's index). */
const m0x = () => model.value.xKind !== 'category'

function setActive(next: Target | null, pointer: [number, number] | null, touch = false) {
  const a = active.value
  if (!next) {
    if (a) {
      active.value = null
      if (!a.synced) tellX(null)
    }
    zoomNote.value = ''
    return
  }
  zoomNote.value = ''
  // the same thing under a pointer that moved: only the tooltip moves
  active.value = { ...next, pointer, touch } as Active
  if (next.type === 'axis' && (a?.type !== 'axis' || a.x !== next.x || a.synced)) tellX(next.x)
}

/* charts whose tooltips share a group follow one another's x */

const group = computed(() => tooltipPart.value?.props.group)

/** The x of this chart as the group shares it: a category's name, else its number. */
function sharedX(x: number): SharedX {
  return model.value.xKind === 'category' ? (model.value.categories[x] ?? null) : x
}

/** Tells the group this chart's x, or that it shows none. */
function tellX(x: number | null) {
  const name = group.value
  if (name) tellGroup(name, x === null ? null : sharedX(x), follow)
}

/** Shows the x another chart of the group points at, if this chart has it. */
function follow(x: SharedX) {
  const a = active.value
  // this chart's own pointer or keys win
  if (a && !a.synced) return
  const mine = x === null || !interactive.value || trigger.value !== 'axis' ? null : localX(x)
  if (mine === null) {
    if (a) active.value = null
    return
  }
  active.value = { type: 'axis', x: mine, pointer: null, synced: true }
}

/** The x of this chart that `x` from the group names: the same category, or the same number. */
function localX(x: string | number): number | null {
  const m = model.value
  if (m.xKind === 'category') {
    const k = typeof x === 'string' ? m.categories.indexOf(x) : -1
    return k < 0 ? null : k
  }
  if (typeof x !== 'number') return null
  // only an x some series has: no tooltip of values that aren't there
  for (const s of series.value) if (rowAt(s.x.values, x) >= 0) return x
  return null
}

watch(
  group,
  (name, _, onCleanup) => {
    if (name) onCleanup(joinGroup(name, follow))
  },
  { immediate: true },
)

/* pointer: a mouse hovers; a finger taps, and a tap elsewhere closes */

let pointerFrame = 0
let lastPointer: [number, number] | null = null

function local(event: MouseEvent): [number, number] {
  const rect = rootRef.value!.getBoundingClientRect()
  return [event.clientX - rect.left, event.clientY - rect.top]
}

function onPointerMove(event: PointerEvent) {
  if (gesture(event)) return
  if (!interactive.value || event.pointerType === 'touch') return
  lastPointer = local(event)
  // once a frame, however fast the pointer moves
  if (pointerFrame || typeof requestAnimationFrame === 'undefined') {
    if (!pointerFrame) followPointer()
    return
  }
  pointerFrame = requestAnimationFrame(() => {
    pointerFrame = 0
    followPointer()
  })
}

function followPointer() {
  if (!lastPointer || drag?.moved) return
  const [x, y] = lastPointer
  setActive(hitAt(x, y), lastPointer)
}

function onPointerLeave(event: PointerEvent) {
  if (event.pointerType === 'touch' || drag?.moved) return
  lastPointer = null
  if (active.value?.pointer) setActive(null, null)
}

/* dragging: to pan when zoomed, to select with a brush; two fingers zoom */

/** A press on the plot that may turn into a pan or a selection. */
let drag: {
  id: number
  touch: boolean
  start: [number, number]
  /** What it does once it moves; `null` for nothing (yet: a finger held still starts a selection). */
  mode: 'pan' | 'brush' | null
  moved: boolean
  /** The scales as it started: the pan follows the pointer from there. */
  from: Scales
  hold: PointerHold
  timer: ReturnType<typeof setTimeout> | undefined
} | null = null

/** Two fingers on the plot: they zoom about the point between them. */
let pinch: { distance: number; middle: [number, number]; from: Scales } | null = null
const fingers = new Map<number, [number, number]>()

/** The selection being dragged, in px. */
const brushDraft = shallowRef<Rect | null>(null)
/** A drag just ended: the click that follows it isn't one. */
let dragged = false

/** How far a press moves before it is a drag, and how long a finger is held to select. */
const SLOP = { mouse: 3, touch: 8 }
const HOLD = 400

function inPlot([px, py]: [number, number]): boolean {
  const plot = layout.value?.plot
  return (
    !!plot &&
    px >= plot.x &&
    px <= plot.x + plot.width &&
    py >= plot.y &&
    py <= plot.y + plot.height
  )
}

let tapped = false
function onPointerDown(event: PointerEvent) {
  const touch = event.pointerType === 'touch'
  tapped = touch && interactive.value
  if (event.button !== 0 || (event.target as Element).closest?.('button')) return
  const at = local(event)
  const from = scalesNow()
  if (!from || !inPlot(at) || !(zoomOn.value || brushPart.value)) return
  if (touch) {
    fingers.set(event.pointerId, at)
    if (fingers.size === 2 && zoomOn.value) {
      startPinch(from)
      return
    }
    if (fingers.size > 1) return
  }
  // a mouse pans when zoomed, and selects with Shift held (or when it can't zoom); a finger pans, and selects when held still
  const brush = !!brushPart.value
  const { sideways, upDown } = panDirections()
  const mode = touch
    ? sideways || upDown
      ? 'pan'
      : null
    : brush && (event.shiftKey || !zoomOn.value)
      ? 'brush'
      : zoomOn.value
        ? 'pan'
        : null
  if (!mode && !(touch && brush)) return
  const hold = holdPointer(event, rootRef.value)
  drag = {
    id: event.pointerId,
    touch,
    start: at,
    mode,
    moved: false,
    from,
    hold,
    timer: undefined,
  }
  if (touch && brush)
    drag.timer = setTimeout(() => {
      if (!drag || drag.moved) return
      drag.mode = 'brush'
      startDrag()
      brushDraft.value = brushRect(drag.start, drag.start)
    }, HOLD)
}

/** The press became a drag: it keeps the pointer, and the tooltip goes. */
function startDrag() {
  if (!drag) return
  drag.moved = true
  tapped = false
  clearTimeout(drag.timer)
  drag.hold.grab()
  if (drag.mode === 'pan' && rootRef.value) rootRef.value.style.cursor = 'grabbing'
  if (!drag.touch) {
    try {
      rootRef.value?.setPointerCapture(drag.id)
    } catch {
      // the pointer is already gone
    }
  }
  setActive(null, null)
}

function startPinch(from: Scales) {
  endDrag(false)
  tapped = false
  const [a, b] = [...fingers.values()] as [[number, number], [number, number]]
  pinch = {
    distance: Math.max(1, Math.hypot(a[0] - b[0], a[1] - b[1])),
    middle: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
    from,
  }
  setActive(null, null)
}

/** Follows a drag or a pinch; `true` when the move was one. */
function gesture(event: PointerEvent): boolean {
  if (pinch && fingers.has(event.pointerId)) {
    fingers.set(event.pointerId, local(event))
    if (fingers.size < 2) return true
    const [a, b] = [...fingers.values()] as [[number, number], [number, number]]
    const distance = Math.max(1, Math.hypot(a[0] - b[0], a[1] - b[1]))
    const middle: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
    const p = pinch
    onceAFrame(() => {
      // zoomed about where the fingers started, then moved with them
      const factor = p.distance / distance
      const x = zoomWindow(p.from.x, alongX(p.middle), factor)
      const y = p.from.y && zoomWindow(p.from.y, alongY(p.middle), factor)
      const by: [number, number] = [middle[0] - p.middle[0], middle[1] - p.middle[1]]
      if (zoomAxes.value.x) showX(panWindow(scaleOver(x, p.from.x), -alongX(by)))
      if (zoomAxes.value.y && y && p.from.y) showY(panWindow(scaleOver(y, p.from.y), -alongY(by)))
    })
    return true
  }
  if (!drag || event.pointerId !== drag.id) return false
  const at = local(event)
  const d = drag
  const by: [number, number] = [at[0] - d.start[0], at[1] - d.start[1]]
  if (!d.moved) {
    if (Math.hypot(...by) < SLOP[d.touch ? 'touch' : 'mouse']) return true
    // a finger that moves before it is held long enough, or the way the chart can't pan, scrolls the page
    const { sideways, upDown } = panDirections()
    const across = Math.abs(by[0]) >= Math.abs(by[1])
    if (!d.mode || (d.touch && d.mode === 'pan' && !(across ? sideways : upDown))) {
      endDrag(false)
      return false
    }
    startDrag()
  }
  if (d.mode === 'pan') onceAFrame(() => panBy(by, d.from))
  else brushDraft.value = brushRect(d.start, at)
  return true
}

let gestureFrame = 0
let gestureNext: (() => void) | null = null
/** Runs `step` once a frame, the latest one, however fast the pointer moves. */
function onceAFrame(step: () => void) {
  gestureNext = step
  if (gestureFrame) return
  if (typeof requestAnimationFrame === 'undefined') {
    gestureNext = null
    step()
    return
  }
  gestureFrame = requestAnimationFrame(() => {
    gestureFrame = 0
    const next = gestureNext
    gestureNext = null
    next?.()
  })
}

/** Ends the drag: `done` when it was let go (not cancelled), which settles a pan and selects. */
function endDrag(done: boolean, at?: [number, number]) {
  const d = drag
  if (!d) return
  drag = null
  clearTimeout(d.timer)
  d.hold.release()
  if (!d.moved) return
  if (d.mode === 'pan' && rootRef.value) rootRef.value.style.cursor = ''
  dragged = !d.touch
  if (gestureFrame) {
    cancelAnimationFrame(gestureFrame)
    gestureFrame = 0
    gestureNext?.()
    gestureNext = null
  }
  if (d.mode === 'pan') showX(xWindow.value, true)
  else if (d.mode === 'brush') {
    const rect = brushDraft.value
    brushDraft.value = null
    if (done && rect) brushTo(at ? brushRect(d.start, at) : rect)
  }
}

function onPointerCancel(event: PointerEvent) {
  // the page scrolled: not a tap
  tapped = false
  fingers.delete(event.pointerId)
  if (pinch && fingers.size < 2) endPinch()
  if (drag?.id === event.pointerId) endDrag(false)
}

function endPinch() {
  pinch = null
  if (gestureFrame) {
    cancelAnimationFrame(gestureFrame)
    gestureFrame = 0
    gestureNext?.()
    gestureNext = null
  }
  showX(xWindow.value, true)
}

function onPointerUp(event: PointerEvent) {
  fingers.delete(event.pointerId)
  if (pinch) {
    if (fingers.size < 2) endPinch()
    return
  }
  const wasDrag = drag?.id === event.pointerId && drag.moved
  if (drag?.id === event.pointerId) endDrag(true, local(event))
  if (!tapped || wasDrag) return
  tapped = false
  const at = local(event)
  setActive(hitAt(...at), at, true)
}

/* the brush: a stretch selected by dragging */

const brushAxes = computed(() => {
  const axis = brushPart.value?.props.axis ?? 'x'
  return { x: axis !== 'y', y: axis !== 'x' }
})

const clampTo = (v: number, from: number, length: number) =>
  Math.min(Math.max(v, from), from + length)

/** The selection from `a` to `b` (in px), across the whole plot along an axis it doesn't select. */
function brushRect(a: [number, number], b: [number, number]): Rect | null {
  const plot = layout.value?.plot
  if (!plot) return null
  const x0 = clampTo(Math.min(a[0], b[0]), plot.x, plot.width)
  const x1 = clampTo(Math.max(a[0], b[0]), plot.x, plot.width)
  const y0 = clampTo(Math.min(a[1], b[1]), plot.y, plot.height)
  const y1 = clampTo(Math.max(a[1], b[1]), plot.y, plot.height)
  const { x: bx, y: by } = brushAxes.value
  // which of the rect's sides each axis selects along
  const horizontal = !!props.horizontal
  const across = horizontal ? by : bx
  const down = horizontal ? bx : by
  return {
    x: across ? x0 : plot.x,
    y: down ? y0 : plot.y,
    width: across ? x1 - x0 : plot.width,
    height: down ? y1 - y0 : plot.height,
  }
}

const inRect = ([px, py]: [number, number], r: Rect) =>
  px >= r.x && px <= r.x + r.width && py >= r.y && py <= r.y + r.height

/** The px a rect spans along x, and along the values. */
const spanX = (r: Rect): Window => (props.horizontal ? [r.y, r.y + r.height] : [r.x, r.x + r.width])
const spanY = (r: Rect): Window => (props.horizontal ? [r.x, r.x + r.width] : [r.y, r.y + r.height])

/** The values `scale` shows over the px `span`, from the smallest. */
function valuesOver(scale: Scale, [a, b]: Window): Window {
  const [u, v] = [scale.invert(a), scale.invert(b)]
  return u <= v ? [u, v] : [v, u]
}

/** Keeps the selection of `rect` (in px) and tells the page; a selection too small to mean one lets it go. */
function brushTo(rect: Rect | null) {
  const l = layout.value
  const part = brushPart.value
  brushAnchor = null
  if (!l || !part || !rect) return
  const { x: bx, y: by } = brushAxes.value
  const xs = spanX(rect)
  const ys = spanY(rect)
  if ((bx && xs[1] - xs[0] < 4) || (by && ys[1] - ys[0] < 4)) {
    clearBrush()
    return
  }
  const m = model.value
  let x: Window | null = null
  if (bx) {
    x = valuesOver(l.x.scale, xs)
    if (m.xKind === 'category') {
      // the categories whose middle is in it
      const from = Math.ceil(x[0])
      const to = Math.floor(x[1])
      if (from > to) {
        clearBrush()
        return
      }
      x = [from - 0.5, to + 0.5]
    }
  }
  const primary = primaryY(l)
  const y = by && primary ? valuesOver(primary.scale, ys) : null
  const xInterval = x
    ? m.xKind === 'linear'
      ? rounded(x)
      : windowToInterval(x, m.xKind, m.categories)
    : null
  const yInterval: ChartInterval | null = y ? rounded(y) : null
  part.x.value = xInterval
  part.y.value = yInterval
  part.select({
    ...(xInterval && { x: xInterval }),
    ...(yInterval && { y: yInterval }),
    ...rowsIn(x, y),
  })
}

/** Where a selection made with Shift and the arrow keys started, along x. */
let brushAnchor: number | null = null

/** The x of an x or a point picked. */
function xOf(target: Target | null): number | null {
  if (!target || target.type === 'slice') return null
  if (target.type === 'axis') return target.x
  return series.value.find((s) => s.index === target.series)?.x.values[target.row] ?? null
}

/** Shift and an arrow: moves on `step` and selects from where it started to there. */
function brushWithKeys(step: number) {
  const part = brushPart.value
  const from = xOf(active.value)
  const next = moveAlong(step)
  const to = xOf(next)
  if (!part || !next || to === null) return
  bringIntoView(next)
  setActive(next, null)
  brushAnchor ??= from ?? to
  const m = model.value
  const lo = Math.min(brushAnchor, to)
  const hi = Math.max(brushAnchor, to)
  const window: Window = m.xKind === 'category' ? [lo - 0.5, hi + 0.5] : [lo, hi]
  const x = windowToInterval(window, m.xKind, m.categories)
  part.x.value = x
  part.y.value = null
  part.select({ x, ...rowsIn(window, null) })
}

/** Lets the selection go, and tells the page: nothing is selected. */
function clearBrush() {
  const part = brushPart.value
  brushAnchor = null
  if (!part || (!part.x.value && !part.y.value)) return
  part.x.value = null
  part.y.value = null
  part.select({ rows: [], series: [] })
}

/** The rows with a point in the selection: x in `x`, and drawn within `y` of the values. */
function rowsIn(x: Window | null, y: Window | null): Pick<ChartBrushEvent, 'rows' | 'series'> {
  const l = layout.value!
  const primary = primaryY(l)
  // the values' stretch in px, to test series on either value axis alike
  const ys = y && primary ? ([primary.scale.map(y[0]), primary.scale.map(y[1])] as Window) : null
  const lowY = ys ? Math.min(...ys) - 0.5 : 0
  const highY = ys ? Math.max(...ys) + 0.5 : 0
  const all = new Set<ChartRow>()
  const bySeries: ChartBrushEvent['series'] = []
  for (const s of series.value) {
    const view = viewOf(s)
    if (!view) continue
    const rows: ChartRow[] = []
    for (const i of sortedOrder(s.x.values)) {
      const value = s.x.values[i]!
      const top = s.top[i]!
      if (top !== top || (x && !within(value, x))) continue
      if (ys) {
        const at = alongY(view.point(value, top))
        if (at < lowY || at > highY) continue
      }
      rows.push(rowOf(s.rows, i))
      all.add(rowOf(s.rows, i))
    }
    bySeries.push({ name: s.name, rows })
  }
  return { rows: [...all], series: bySeries }
}

/** The selection to keep the rest faded around, while it is dragged or kept. */
const dimmed = computed(() =>
  brushPart.value && brushPart.value.props.dim !== false
    ? (brushDraft.value ?? selection.value)
    : null,
)

/** The selection kept (`v-model:x` / `v-model:y` of the brush), in px over the plot. */
const selection = computed<Rect | null>(() => {
  const part = brushPart.value
  const l = layout.value
  if (!part || !l || (!part.x.value && !part.y.value)) return null
  const m = model.value
  const { plot } = l
  const x = intervalToWindow(part.x.value, m.xKind, m.categories)
  const y = part.y.value ? intervalToWindow(part.y.value, 'linear', []) : null
  const primary = primaryY(l)
  const xs: Window = x
    ? [l.x.scale.map(x[0]), l.x.scale.map(x[1])]
    : props.horizontal
      ? [plot.y, plot.y + plot.height]
      : [plot.x, plot.x + plot.width]
  const ys: Window =
    y && primary
      ? [primary.scale.map(y[0]), primary.scale.map(y[1])]
      : props.horizontal
        ? [plot.x, plot.x + plot.width]
        : [plot.y + plot.height, plot.y]
  const [a, b] = props.horizontal ? [ys, xs] : [xs, ys]
  // kept to the plot: zoomed in, part of it may be out of sight
  const left = Math.max(plot.x, Math.min(a[0], a[1]))
  const right = Math.min(plot.x + plot.width, Math.max(a[0], a[1]))
  const top = Math.max(plot.y, Math.min(b[0], b[1]))
  const bottom = Math.min(plot.y + plot.height, Math.max(b[0], b[1]))
  if (right <= left || bottom <= top) return null
  return { x: left, y: top, width: right - left, height: bottom - top }
})

/* the wheel and a double click */

/** How much a wheel turn zooms, per px of its delta (pinches send small deltas, wheels large ones). */
const WHEEL_ZOOM = 0.01
const WHEEL_MOST = 40

function onWheel(event: WheelEvent) {
  if (!zoomOn.value) return
  const at = local(event)
  if (!inPlot(at)) return
  const lines = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 400 : 1
  let dx = event.deltaX * lines
  let dy = event.deltaY * lines
  // a pinch on a trackpad comes as the wheel with Ctrl held
  const pinching = event.ctrlKey || event.metaKey
  if (pinching || zoomPart.value?.props.wheel) {
    // all shown, zooming out: the wheel scrolls the page on
    if (!pinching && !zoomed.value && dy > 0) return
    event.preventDefault()
    const d = Math.max(-WHEEL_MOST, Math.min(WHEEL_MOST, dy))
    setActive(null, null)
    onceAFrame(() => zoomBy(Math.exp(d * WHEEL_ZOOM), at))
    settleSoon()
    return
  }
  // zoomed in: a sideways scroll (or Shift and the wheel) pans along x
  if (event.shiftKey && !dx) [dx, dy] = [dy, 0]
  if (!zoomed.value || !(Math.abs(dx) > Math.abs(dy))) return
  event.preventDefault()
  setActive(null, null)
  const by: [number, number] = props.horizontal ? [0, -dx] : [-dx, 0]
  onceAFrame(() => panBy(by))
  settleSoon()
}

let settleTimer: ReturnType<typeof setTimeout> | undefined
/** Once the wheel stops, categories cut part way are shown whole. */
function settleSoon() {
  clearTimeout(settleTimer)
  settleTimer = setTimeout(() => showX(xWindow.value, true), 160)
}
onBeforeUnmount(() => clearTimeout(settleTimer))

function onDblclick(event: MouseEvent) {
  if (!zoomOn.value || !inPlot(local(event))) return
  event.preventDefault()
  resetZoom()
}

// a press anywhere else closes a tooltip opened by a tap or the keys
function onOutsidePress(event: PointerEvent) {
  if (!active.value) return
  const root = rootRef.value
  if (root && !root.contains(event.target as Node)) setActive(null, null)
}
onMounted(() => document.addEventListener('pointerdown', onOutsidePress, true))
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onOutsidePress, true)
  if (pointerFrame) cancelAnimationFrame(pointerFrame)
})

/* keys: arrows move along x and between series; Home and End go to the ends */

function onKeydown(event: KeyboardEvent) {
  if (!interactive.value || event.target !== rootRef.value) return
  if (event.key === 'Enter') {
    if (tip.value) select(tip.value)
    return
  }
  if (event.key === 'Escape') {
    if (active.value) setActive(null, null)
    else if (selection.value) clearBrush()
    else return
    event.stopPropagation()
    return
  }
  if (zoomOn.value && zoomKey(event)) {
    event.preventDefault()
    return
  }
  const horizontal = !!props.horizontal
  const along: Record<string, number> = horizontal
    ? { ArrowDown: 1, ArrowUp: -1 }
    : { ArrowRight: 1, ArrowLeft: -1 }
  const between: Record<string, number> = horizontal
    ? { ArrowRight: 1, ArrowLeft: -1 }
    : { ArrowUp: 1, ArrowDown: -1 }
  const step =
    along[event.key] ?? (event.key === 'Home' ? -Infinity : event.key === 'End' ? Infinity : 0)
  const turn = between[event.key] ?? 0
  if (step && event.shiftKey && brushPart.value && brushAxes.value.x && !pie.value) {
    event.preventDefault()
    brushWithKeys(step)
    return
  }
  if (step || turn) brushAnchor = null
  const next = step ? moveAlong(step) : turn ? moveBetween(turn) : undefined
  if (next === undefined) return
  event.preventDefault()
  if (next) bringIntoView(next)
  if (next) setActive(next, null)
}

/** `+` and `-` zoom about what is picked (or the middle), `0` shows all; `true` when it was one. */
function zoomKey(event: KeyboardEvent): boolean {
  const l = layout.value
  if (!l || event.ctrlKey || event.metaKey || event.altKey) return false
  const factor = event.key === '+' || event.key === '=' ? 0.5 : event.key === '-' ? 2 : 0
  if (event.key === '0') {
    resetZoom(true)
    return true
  }
  if (!factor) return false
  const { plot } = l
  const t = tip.value
  const at: [number, number] = t
    ? [t.anchor[0], t.anchor[1]]
    : [plot.x + plot.width / 2, plot.y + plot.height / 2]
  // about the x picked, along the x axis
  if (t?.x !== undefined && active.value?.type === 'axis') {
    const x = l.x.scale.map(active.value.x)
    if (props.horizontal) at[1] = x
    else at[0] = x
  }
  zoomBy(factor, at)
  showX(xWindow.value, true)
  const now = layout.value
  if (!now) return true
  const [from, to] = now.x.scale.domain
  const m = model.value
  const ends =
    m.xKind === 'category'
      ? windowToInterval([from, to], m.xKind, m.categories).map(String)
      : [xText(from), xText(to)]
  zoomNote.value = zoomed.value
    ? format(messages.value.zoomed, { from: ends[0]!, to: ends[1]! })
    : messages.value.zoomReset
  return true
}

/** Zoomed in: moves what is shown so the x the keys moved to is in sight. */
function bringIntoView(target: Target) {
  const l = layout.value
  if (!l || !xWindow.value || target.type === 'slice') return
  const x =
    target.type === 'axis'
      ? target.x
      : series.value.find((s) => s.index === target.series)?.x.values[target.row]
  if (x === undefined) return
  const [a, b] = xWindow.value
  const span = b - a
  // a little room past it, or the whole category
  const room = model.value.xKind === 'category' ? 0.5 : span * 0.05
  if (x - room < a) showX([x - room, x - room + span], true)
  else if (x + room > b) showX([x + room - span, x + room], true)
}

/**
 * The place `step` on from `at` among `n`, kept to the ends; from nothing
 * picked, the first (or the last, going back).
 */
function stepTo(at: number, step: number, n: number): number {
  if (at < 0 && Number.isFinite(step)) return step > 0 ? 0 : n - 1
  return Math.max(0, Math.min(n - 1, at + step))
}

/** The next x, point or slice `step` along (±Infinity for the ends). */
function moveAlong(step: number): Target | null {
  const a = active.value
  if (pie.value) {
    const shown = slices.value.flatMap((slice, k) => (slice.hidden ? [] : [k]))
    if (!shown.length) return null
    const at = a?.type === 'slice' ? shown.indexOf(a.slice) : -1
    const k = stepTo(at, step, shown.length)
    return { type: 'slice', slice: shown[k]! }
  }
  if (trigger.value === 'axis') {
    const xs = xValues.value
    if (!xs.length) return null
    const at = a?.type === 'axis' ? xs.indexOf(a.x) : -1
    const k = stepTo(at, step, xs.length)
    return { type: 'axis', x: xs[k]! }
  }
  const s =
    (a?.type === 'item' && series.value.find((x) => x.index === a.series)) || series.value[0]
  if (!s) return null
  const order = pointsOf(s)
  if (!order.length) return null
  const at = a?.type === 'item' && a.series === s.index ? order.indexOf(a.row) : -1
  const k = stepTo(at, step, order.length)
  return itemOf(s, order[k]!)
}

/** The point of the next series `turn` away, nearest to the current x. */
function moveBetween(turn: number): Target | null | undefined {
  const a = active.value
  if (pie.value || trigger.value === 'axis') return undefined
  const list = series.value.filter((s) => pointsOf(s).length)
  if (!list.length) return null
  const at = a?.type === 'item' ? list.findIndex((s) => s.index === a.series) : -1
  const s = list[at < 0 ? 0 : (at + turn + list.length) % list.length]!
  const order = pointsOf(s)
  if (a?.type !== 'item') return itemOf(s, order[0]!)
  const from = series.value.find((x) => x.index === a.series)
  const x = from ? from.x.values[a.row]! : 0
  let best = order[0]!
  for (const row of order)
    if (Math.abs(s.x.values[row]! - x) < Math.abs(s.x.values[best]! - x)) best = row
  return itemOf(s, best)
}

/** The rows of `s` with a value, from the smallest x. */
function pointsOf(s: ChartSeries): number[] {
  const order = sortedOrder(s.x.values)
  const out: number[] = []
  for (const row of order) if (s.top[row] === s.top[row]) out.push(row)
  return out
}

function itemOf(s: ChartSeries, row: number): Target {
  const view = viewOf(s)
  const x = s.x.values[row]!
  const at = view?.point(x, s.top[row]!)
  // the hit at the point itself, for the size of its mark
  const hit = view && at && s.kind.hit ? s.kind.hit(s, view, at[0], at[1]) : null
  return { type: 'item', series: s.index, row, radius: hit?.index === row ? hit.radius : 4 }
}

/** Every x with a value, from the smallest: where the keys stop. */
const xValues = computed(() => allX(series.value.map((s) => s.x.values)))

// an x, point or slice gone from the data: nothing to show
watch([series, slices], () => {
  const a = active.value
  if (!a) return
  if (a.pointer) {
    const next = hitAt(...a.pointer)
    setActive(next, a.pointer, a.touch)
  } else if (!tip.value) setActive(null, null)
})

/** Read out as the keys move: the x (or series) and its values, or what zooming shows. */
const live = computed(() => {
  if (zoomNote.value) return zoomNote.value
  const t = tip.value
  // read out only what the keys picked here, not what another chart points at
  if (!t || active.value?.pointer || active.value?.synced) return ''
  const items = t.items
    .map((item) => `${item.name} ${item.text}`)
    .join(messages.value.itemSeparator)
  const text = t.title ? `${t.title}${messages.value.itemSeparator}${items}` : items
  return t.note ? `${text}${messages.value.itemSeparator}${t.note}` : text
})

const pointer: PointerState = {
  tip,
  size: computed(() => {
    const l = layout.value ?? pieLayout.value
    return l && { width: l.width, height: l.height }
  }),
  content: computed(() => tooltipPart.value?.content()),
  live,
}

/* drawing: everything that changes asks for one frame */

let pending = 0
function request() {
  if (pending || typeof requestAnimationFrame === 'undefined') return
  pending = requestAnimationFrame(() => {
    pending = 0
    draw()
  })
}
onBeforeUnmount(() => pending && cancelAnimationFrame(pending))

watch(
  // every series prop, so a style change (smooth, dashed) redraws too
  () => [
    layout.value,
    pieLayout.value,
    series.value,
    sliceColors.value,
    colors.value,
    seriesParts.value.map((part) => ({ ...part.props })),
    pie.value && { ...pie.value.props },
    focused.value,
    pointed.value,
    pieLabels.value,
    labelsShown.value,
    pie.value && active.value,
    dimmed.value,
  ],
  request,
  { flush: 'post' },
)

/*
 * What makes zooming and the first hover quick (summaries of long lines, a
 * scatter's grid), worked out once the data has stayed a moment and the
 * page is idle: live data, replaced many times a second, never pays for it.
 */

const STEADY = 300
let steady = 0
let idle = 0
function cancelPrepare() {
  if (steady) clearTimeout(steady)
  if (idle) (typeof cancelIdleCallback === 'function' ? cancelIdleCallback : clearTimeout)(idle)
  steady = idle = 0
}
watch(
  series,
  (list) => {
    cancelPrepare()
    if (!list.some((s) => s.kind.prepare)) return
    const work = () => {
      idle = 0
      for (const s of list) if (s.kind.prepare) s.prepared = s.kind.prepare(s)
    }
    steady = setTimeout(() => {
      steady = 0
      idle =
        typeof requestIdleCallback === 'function'
          ? requestIdleCallback(work, { timeout: 1000 })
          : (setTimeout(work) as unknown as number)
    }, STEADY) as unknown as number
  },
  { flush: 'post' },
)
onBeforeUnmount(cancelPrepare)

/* motion: series come in, and move to new values */

const reduced = useReducedMotion()
/** Above this many points, changes show at once. */
const MOTION_LIMIT = 2000
const ENTER = 320
const UPDATE = 220
const easeOut = (t: number) => 1 - (1 - t) ** 3

interface Shown {
  top: Float64Array
  base: Float64Array | null
  ends: { up: Float64Array; down: Float64Array } | null
}

/** A move under way: from what was shown to the current data. */
let motion: {
  start: number
  duration: number
  /** Coming in for the first time: lines are drawn from the start, bars grow. */
  enter: boolean
  series: Map<number, Shown>
  slices: Map<number, [number, number]>
} | null = null
/** The model and slices last drawn, and how they were drawn, to move from. */
let drawnModel: ChartModel | null = null
let drawnSlices: PieSlice[] | null = null
let lastSeries: ChartSeries[] = []
let lastSlices: PieSlice[] = []

function pointCount(): number {
  if (pie.value) return slices.value.length
  let n = 0
  for (const s of model.value.series) n += s.y.length
  return n
}

/** Whether the chart has been on screen: it comes in when first seen, not while scrolled away. */
let seen = typeof IntersectionObserver === 'undefined'
/**
 * Whether the chart is on screen, or near it. Off screen nothing is drawn
 * (live data keeps coming), and it is drawn as it is when it comes back.
 */
let onScreen = true
let missed = false
let watcher: IntersectionObserver | undefined
onMounted(() => {
  if (typeof IntersectionObserver === 'undefined' || !rootRef.value) return
  watcher = new IntersectionObserver(
    (entries) => {
      const entry = entries[entries.length - 1]
      if (!entry) return
      onScreen = entry.isIntersecting
      if (!onScreen) return
      // first seen: it comes in now
      if (!seen || missed) request()
      seen = true
      missed = false
    },
    { rootMargin: '200px 0px' },
  )
  watcher.observe(rootRef.value)
})
onBeforeUnmount(() => watcher?.disconnect())

/** Starts a move when the data changed since the last frame. */
function startMotion(now: number) {
  if (!seen) return
  const m = model.value
  const changed = pie.value ? drawnSlices !== slices.value : drawnModel !== m
  const first = pie.value ? !drawnSlices : !drawnModel
  if (!changed || empty.value) return
  drawnModel = m
  drawnSlices = slices.value
  if (reduced.value || pointCount() > MOTION_LIMIT) {
    motion = null
    return
  }
  const from = new Map<number, Shown>()
  const angles = new Map<number, [number, number]>()
  if (!first) {
    // from where things were last drawn, mid-move or not
    for (const s of lastSeries) from.set(s.index, { top: s.top, base: s.base, ends: s.stackEnds })
    for (const slice of lastSlices) angles.set(slice.index, [slice.start, slice.end])
  }
  // labels come in once the series have
  if (first) labelsShown.value = false
  motion = {
    start: now,
    duration: first ? ENTER : UPDATE,
    enter: first,
    series: from,
    slices: angles,
  }
}

function lerp(from: Float64Array, to: Float64Array, t: number): Float64Array {
  if (from.length !== to.length) return to
  const out = new Float64Array(to.length)
  for (let i = 0; i < to.length; i++) {
    const a = from[i]!
    const b = to[i]!
    // a value that comes or goes shows at once
    out[i] = a === a ? a + (b - a) * t : b
  }
  return out
}

/** The series `t` of the way (0 to 1) from what was shown. */
function shownSeries(t: number): ChartSeries[] {
  const list = series.value
  if (!motion || t >= 1) return list
  return list.map((s) => {
    let from = motion!.series.get(s.index)
    // bars and areas grow from the baseline; lines come in from the start (see `paint`).
    // Coming in, a stack grows as a whole (each slice's base grows too, so the
    // slices stay on each other); a series added later grows from its own base.
    if (!from && s.kind.zero) {
      const zero = new Float64Array(s.top.length).fill(baselineValue(s))
      const base = motion!.enter ? s.base && zero : s.base
      const start = base ?? zero
      from = { top: start, base, ends: s.stackEnds && { up: start, down: start } }
    }
    if (!from) return s
    return {
      ...s,
      top: lerp(from.top, s.top, t),
      base: s.base && from.base ? lerp(from.base, s.base, t) : s.base,
      stackEnds:
        s.stackEnds && from.ends
          ? {
              up: lerp(from.ends.up, s.stackEnds.up, t),
              down: lerp(from.ends.down, s.stackEnds.down, t),
            }
          : s.stackEnds,
    }
  })
}

/** Where a series' bars grow from: 0, or the end of the axis nearest to it. */
function baselineValue(s: ChartSeries): number {
  const axis = layout.value?.y[s.axis]
  if (!axis) return 0
  const [lo, hi] = axis.scale.domain
  return Math.min(Math.max(0, lo), hi)
}

function shownSlicesAt(t: number): PieSlice[] {
  const list = slices.value
  if (!motion || motion.enter || t >= 1) return list
  return list.map((slice) => {
    const from = motion!.slices.get(slice.index)
    if (!from) return slice
    return {
      ...slice,
      start: from[0] + (slice.start - from[0]) * t,
      end: from[1] + (slice.end - from[1]) * t,
    }
  })
}

function draw() {
  const canvas = canvasRef.value
  const l = layout.value ?? pieLayout.value
  if (!canvas || !l) return
  if (!onScreen) {
    missed = true
    return
  }
  const now = typeof performance === 'undefined' ? Date.now() : performance.now()
  // the server's drawing is already showing: the chart doesn't come in again
  if (fromServer.value) {
    drawnModel = model.value
    drawnSlices = slices.value
  }
  startMotion(now)
  const dpr = window.devicePixelRatio || 1
  const width = Math.round(l.width * dpr)
  const height = Math.round(l.height * dpr)
  if (canvas.width !== width) canvas.width = width
  if (canvas.height !== height) canvas.height = height
  // set here, not in the template: the chart itself doesn't render again on resize
  canvas.style.width = `${l.width}px`
  canvas.style.height = `${l.height}px`
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, l.width, l.height)
  if (empty.value) return
  const done = motion ? Math.min(1, (now - motion.start) / motion.duration) : 1
  const t = easeOut(done)
  const entering = motion?.enter ? t : 1
  if (pieLayout.value) paintPie(ctx, t, entering)
  else paint(ctx, dpr, t, entering)
  // the canvas shows the chart now: the server's image goes
  fromServer.value = false
  // the next frame of the move
  if (done >= 1) motion = null
  else request()
  if (!motion?.enter) labelsShown.value = true
}

/** Draws the pie; `still` leaves out what follows the pointer and the legend (an export). */
function paintPie(painter: Painter, t: number, sweep: number, still = false) {
  const l = pieLayout.value!
  const a = still ? null : active.value
  const legendFocus = still || focused.value === null ? undefined : slices.value[focused.value]
  const hovered = a?.type === 'slice' ? slices.value[a.slice] : undefined
  const focus = legendFocus && !legendFocus.hidden ? legendFocus : hovered
  const shown = shownSlicesAt(t)
  if (!still) lastSlices = shown
  drawPie(painter, shown, sliceColors.value, {
    cx: l.cx,
    cy: l.cy,
    radius: l.radius,
    inner: l.radius * holeRatio.value,
    surface: colors.value.surface,
    focus: focus?.index,
    fade: legendFocus ? FADED : 0.56,
    sweep,
  })
  // the lines out to the labels, once they show
  const leaders = pieLabels.value.leaders
  if (!leaders.length || !(still || labelsShown.value)) return
  painter.save()
  painter.strokeStyle = colors.value.baseline
  painter.lineWidth = 1
  painter.lineJoin = 'round'
  painter.beginPath()
  for (const line of leaders)
    line.forEach(([x, y], k) => (k ? painter.lineTo(x, y) : painter.moveTo(x, y)))
  painter.stroke()
  painter.restore()
}

const holeRatio = computed(() => Math.min(0.95, Math.max(0, pie.value?.props.innerRadius ?? 0)))

/** Whether an axis is drawn across the chart (along the bottom or top), so its grid lines stand up. */
const across = (axis: AxisLayout) => axis.position === 'bottom' || axis.position === 'top'

/** The scales and room a series draws with; `vector` for an SVG, which takes no images. */
function viewOf(s: ChartSeries, dpr = dprNow(), vector = false): ChartView | null {
  const l = layout.value
  if (!l) return null
  const y = l.y[s.axis]
  if (!y) return null
  const horizontal = !!props.horizontal
  const { plot } = l
  const xScale = l.x.scale
  const ys = y.scale
  const step = model.value.xStep
  const band =
    xScale.kind === 'category'
      ? xScale.step
      : step > 0
        ? step * Math.abs(xScale.k)
        : (horizontal ? plot.height : plot.width) / 8
  const point: ChartView['point'] = horizontal
    ? (x, value) => [ys.map(value), xScale.map(x)]
    : (x, value) => [xScale.map(x), ys.map(value)]
  return { x: xScale, y: ys, horizontal, band, point, plot, dpr, vector, colors: colors.value }
}

const dprNow = () => (typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1)

/** A canvas to draw faded series on, then onto the chart at once: a series sets its own alpha. */
let fadeLayer: HTMLCanvasElement | null = null

const markerColor = (tone: Tone) => markerColors.value[tone]

/**
 * Draws the chart with axes. `still` draws it as it stands, without what
 * follows the pointer, the legend or a selection: for an SVG.
 */
function paint(painter: Painter, dpr: number, t: number, entering: number, still = false) {
  const l = layout.value!
  const { plot } = l
  const c = colors.value
  const right = plot.x + plot.width
  const bottom = plot.y + plot.height
  const xLine = !axes.value.x.hidden
  const horizontal = !!props.horizontal

  // grid lines, under everything
  painter.save()
  painter.lineWidth = 1
  painter.strokeStyle = c.grid
  painter.beginPath()
  for (const axis of [l.x, l.y.y, l.y.y2]) {
    if (!axis?.grid) continue
    for (const tick of axis.ticks) {
      const at = crisp(axis.scale.map(tick), dpr)
      if (across(axis)) {
        // the line on the left is the x axis
        if (horizontal && xLine && at <= plot.x + 0.5) continue
        painter.moveTo(at, plot.y)
        painter.lineTo(at, bottom)
      } else {
        // the line at the bottom is the x axis
        if (!horizontal && xLine && at >= bottom - 0.5) continue
        painter.moveTo(plot.x, at)
        painter.lineTo(right, at)
      }
    }
  }
  painter.stroke()
  painter.restore()

  // bands, under the series
  const markers = placedMarkers.value
  drawMarkers(painter, markers, markerColor, dpr, true)

  // series, kept to the plot (with room for a line's width and a dot at the edge)
  const xRoom = xWindow.value ? 0 : 4
  const yRoom = zoomAxes.value.y && yWindow.value ? 0 : 4
  const clip = (target: Painter, s: ChartSeries) => {
    target.beginPath()
    // coming in: lines and points are drawn from the start of the x axis
    const reveal = s.kind.zero ? 1 : entering
    // zoomed in, what runs past the plot is cut at its edge
    const [ax, ay] = horizontal ? [yRoom, xRoom] : [xRoom, yRoom]
    const width = plot.width + ax * 2
    const height = plot.height + ay * 2
    if (horizontal) target.rect(plot.x - ax, plot.y - ay, width, height * reveal)
    else target.rect(plot.x - ax, plot.y - ay, width * reveal, height)
    target.clip()
  }
  const shown = shownSeries(t)
  if (!still) lastSeries = shown
  const focus = still ? -1 : (focused.value ?? pointed.value ?? -1)
  const fading = focus >= 0 && shown.some((s) => s.index === focus)
  const vector = isSvg(painter)
  /** Draws `s` faded, all at once; `false` where it can't be. */
  const drawFaded = (s: ChartSeries, view: ChartView) => {
    if (isSvg(painter)) {
      painter.layer(FADED, () => {
        painter.save()
        clip(painter, s)
        s.kind.draw(painter, s, view)
        painter.restore()
      })
      return true
    }
    const layer = fadeOn(painter as CanvasRenderingContext2D, l.width, l.height, dpr)
    if (!layer) return false
    layer.save()
    clip(layer, s)
    s.kind.draw(layer, s, view)
    layer.restore()
    painter.save()
    painter.globalAlpha = FADED
    painter.drawImage(layer.canvas, 0, 0, l.width, l.height)
    painter.restore()
    return true
  }
  // a selection: what is outside it is faded, with room past the plot's edges it reaches
  const kept = still ? null : dimmed.value
  const keep = kept && {
    x: kept.x <= plot.x ? kept.x - 4 : kept.x,
    y: kept.y <= plot.y ? kept.y - 4 : kept.y,
    right: kept.x + kept.width >= right ? right + 4 : kept.x + kept.width,
    bottom: kept.y + kept.height >= bottom ? bottom + 4 : kept.y + kept.height,
  }
  for (const s of shown) {
    const view = viewOf(s, dpr, vector)
    if (!view) continue
    if (fading && s.index !== focus && drawFaded(s, view)) continue
    if (keep && !drawFaded(s, view)) continue
    painter.save()
    clip(painter, s)
    if (keep) {
      painter.beginPath()
      painter.rect(keep.x, keep.y, keep.right - keep.x, keep.bottom - keep.y)
      painter.clip()
    }
    s.kind.draw(painter, s, view)
    painter.restore()
  }

  // the x axis line, and a line at 0 when the values cross it
  painter.save()
  painter.lineWidth = 1
  painter.strokeStyle = c.baseline
  painter.beginPath()
  if (xLine) {
    if (horizontal) {
      const x = crisp(plot.x, dpr)
      painter.moveTo(x, plot.y)
      painter.lineTo(x, bottom)
    } else {
      const y = crisp(bottom, dpr)
      painter.moveTo(plot.x, y)
      painter.lineTo(right, y)
    }
  }
  const primary = l.y.y ?? l.y.y2
  if (primary && primary.scale.kind === 'linear') {
    const [lo, hi] = primary.scale.domain
    if (lo < 0 && hi > 0) {
      const at = crisp(primary.scale.map(0), dpr)
      if (horizontal) {
        painter.moveTo(at, plot.y)
        painter.lineTo(at, bottom)
      } else {
        painter.moveTo(plot.x, at)
        painter.lineTo(right, at)
      }
    }
  }
  painter.stroke()
  painter.restore()

  // lines and points, over everything
  drawMarkers(painter, markers, markerColor, dpr, false)
}

/** A clear canvas the size of the chart to draw a faded series on; `null` where there is none. */
function fadeOn(main: CanvasRenderingContext2D, width: number, height: number, dpr: number) {
  if (typeof document === 'undefined') return null
  fadeLayer ??= document.createElement('canvas')
  if (fadeLayer.width !== main.canvas.width) fadeLayer.width = main.canvas.width
  if (fadeLayer.height !== main.canvas.height) fadeLayer.height = main.canvas.height
  const ctx = fadeLayer.getContext('2d')
  if (!ctx) return null
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, width, height)
  return ctx
}

/* what is read out */

/** Values as their axis shows them. */
function valueText(axis: ChartValueAxis): (value: number) => string {
  return axes.value[axis]?.format ?? numberFormatFull(locale.value.name)
}

/**
 * A series' value at `row` as the tooltip writes it: a band's two ends, a
 * share of a whole stack with its value, or the value as its axis shows it.
 */
function seriesText(s: ChartSeries, row: number): string {
  const y = s.y[row]!
  if (s.base && !s.stackEnds) {
    const text = valueText(s.axis)
    return format(messages.value.band, { from: text(s.base[row]!), to: text(y) })
  }
  if (s.stackEnds && axes.value[s.axis] && declaredAxes.value[s.axis]?.percent)
    return format(messages.value.share, {
      value: numberFormatFull(locale.value.name)(y),
      share: percent.value.format(Math.abs(s.top[row]! - s.base![row]!)),
    })
  return valueText(s.axis)(y)
}

/** An x as the axis shows it, in full. */
function xText(value: number): string {
  const m0 = model.value
  const name = locale.value.name
  const xFormat = axes.value.x.format
  if (m0.xKind === 'category') {
    const category = m0.categories[value] ?? ''
    return xFormat ? xFormat(category) : category
  }
  if (m0.xKind === 'time') {
    if (xFormat) return xFormat(new Date(value))
    // as precise as the time itself, and as its nearest neighbor needs
    let gap = Number.POSITIVE_INFINITY
    for (const s of series.value) gap = Math.min(gap, neighborGap(s.x.values, value))
    const { unit, digits } = timePrecision(value, gap)
    return timeFormatFull(name, unit, digits)(value)
  }
  if (xFormat) return xFormat(value)
  // whole numbers on the axis (years) read as the ticks show them
  return m0.xIntegers && m0.x
    ? numberTickFormat(name, m0.x, { years: true })(value)
    : numberFormatFull(name)(value)
}

const label = computed(() => {
  if (props.ariaLabel) return props.ariaLabel
  const m = messages.value
  const name = locale.value.name
  const m0 = model.value
  if (empty.value) return format(m.summary, { chart: m.chart, series: m.empty })
  if (pie.value) {
    const value = numberFormatFull(name)
    const list = shownSlices.value
      .map((slice) =>
        format(m.slice, {
          label: slice.label,
          value: value(slice.value),
          share: percent.value.format(slice.share),
        }),
      )
      .join(m.listSeparator)
    const off = slices.value.length - shownSlices.value.length
    const shown = off ? `${list}${m.itemSeparator}${format(m.hiddenSlices, { count: off })}` : list
    const title = pie.value.props.name
    return withKeys(
      format(m.summary, {
        chart: m.chart,
        series: title ? format(m.pie, { name: title, slices: shown }) : shown,
      }),
    )
  }
  const count = numberFormatFull(name)
  const parts = m0.series.map((s) => {
    let range = extent(s.y)
    // a band reaches down to its bottom
    const low = s.base && !s.stackEnds ? extent(s.base) : null
    if (range && low) range = [Math.min(range[0], low[0]), Math.max(range[1], low[1])]
    if (!range) return format(m.seriesEmpty, { name: s.name })
    let points = 0
    for (let i = 0; i < s.y.length; i++) if (s.y[i] === s.y[i]) points++
    // a percent axis writes shares; the values themselves are read out
    const text =
      s.stackEnds && declaredAxes.value[s.axis]?.percent
        ? numberFormatFull(name)
        : valueText(s.axis)
    return format(m.series, {
      name: s.name,
      count: count(points),
      min: text(range[0]),
      max: text(range[1]),
    })
  })
  let chart = m.chart
  if (m0.x) {
    chart = format(props.horizontal ? m.rangeDown : m.range, {
      chart: m.chart,
      from: xText(m0.x[0]),
      to: xText(m0.x[1]),
    })
  }
  return withKeys(format(m.summary, { chart, series: parts.join(m.listSeparator) }))
})

/* the table view: the data as rows and columns, in the chart's place */

/** The most rows the table shows: more would take long to lay out, and to read. */
const TABLE_ROWS = 1000

/** The table's head, and every row's cells (the first is the row's head). */
const tableCells = computed<{ head: string[]; rows: string[][] }>(() => {
  if (!props.table || empty.value) return { head: [], rows: [] }
  const m = messages.value
  if (pie.value) {
    const value = numberFormatFull(locale.value.name)
    const title =
      typeof (pie.value.props.label ?? props.x) === 'string'
        ? String(pie.value.props.label ?? props.x)
        : ''
    return {
      head: [title, pie.value.props.name ?? m.tableValue, m.tableShare],
      rows: shownSlices.value.map((slice) => [
        slice.label,
        value(slice.value),
        percent.value.format(slice.share),
      ]),
    }
  }
  const list = series.value
  const xHead = axes.value.x.title ?? (typeof props.x === 'string' ? props.x : '')
  // points on their own (a scatter's): one row each, with its series
  if (list.some((s) => s.kind.tooltip === 'item')) {
    const rows: string[][] = []
    for (const s of list)
      for (let i = 0; i < s.y.length; i++) {
        const x = s.x.values[i]!
        if (x !== x || s.y[i] !== s.y[i]) continue
        rows.push([s.name, xText(x), seriesText(s, i)])
      }
    return { head: [m.tableSeries, xHead, axes.value.y?.title ?? m.tableValue], rows }
  }
  // each x a row, each series a column
  const xs = allX(list.map((s) => s.x.values))
  return {
    // a value's unit is in its axis' title (“销售额（万元）”): its column says it too
    head: [xHead, ...list.map((s) => withUnit(s.name, axes.value[s.axis]?.title))],
    rows: xs.map((x) => [
      xText(x),
      ...list.map((s) => {
        const row = rowAt(s.x.values, x)
        return row < 0 || s.y[row] !== s.y[row] ? '' : seriesText(s, row)
      }),
    ]),
  }
})

/** `name` with the unit at the end of `title` (in brackets), if it hasn't one already. */
function withUnit(name: string, title: string | undefined): string {
  const unit = title && /\s*[(（][^()（）]+[)）]\s*$/.exec(title)?.[0].trim()
  return unit && !name.endsWith(unit) ? `${name}${unit}` : name
}

/** The table's caption: the chart's name, else what its series are. */
const tableCaption = computed(() => {
  if (props.ariaLabel) return props.ariaLabel
  const m = messages.value
  const names = pie.value
    ? [pie.value.props.name].filter((name): name is string => !!name)
    : series.value.map((s) => s.name)
  return names.length ? format(m.tableOf, { names: names.join(m.nameSeparator) }) : m.table
})

const table: TableState = {
  shown: computed(() => !!props.table && !fromServer.value),
  caption: tableCaption,
  head: computed(() => tableCells.value.head),
  rows: computed(() => tableCells.value.rows.slice(0, TABLE_ROWS)),
  more: computed(() => {
    const count = tableCells.value.rows.length
    if (count <= TABLE_ROWS) return ''
    const number = numberFormatFull(locale.value.name)
    return format(messages.value.tableMore, { shown: number(TABLE_ROWS), count: number(count) })
  }),
  close: () => {
    emit('update:table', false)
    // back on the chart, where the keys were
    rootRef.value?.focus()
  },
}

/** The summary, and how to explore it when the chart can be. */
function withKeys(summary: string): string {
  if (!interactive.value) return summary
  return format(zoomOn.value ? messages.value.zoomKeys : messages.value.keys, { summary })
}

const labels = computed(() => {
  const l = layout.value
  if (!l) return []
  const out: Array<TickLabel & { key: string; axis: string }> = []
  for (const axis of [l.x, l.y.y, l.y.y2]) {
    if (!axis) continue
    axis.labels.forEach((tick, i) =>
      out.push({ ...tick, key: `${axis.position}:${i}`, axis: axis.position }),
    )
  }
  return out
})

const legend = computed(() => {
  const l = layout.value ?? pieLayout.value
  if (!l) return []
  return l.legend.map((item) => ({ ...item, ...legendEntries.value[item.index]! }))
})

const titles = computed(() => {
  const l = layout.value
  if (!l) return []
  return [l.x, l.y.y, l.y.y2].flatMap((axis) =>
    axis?.title ? [{ key: axis.position, ...axis.title }] : [],
  )
})

/** The size of what is drawn: a chart with axes, or a pie. */
const frame = computed(() => layout.value ?? pieLayout.value)

const overlay: OverlayState = {
  // while the server's drawing shows, its own text does
  shown: computed(() => !!frame.value && !empty.value && !fromServer.value),
  labels,
  titles,
  legend,
  legendBox: computed(() => (layout.value ?? pieLayout.value)?.legendBox),
  hole: computed(() => {
    const l = pieLayout.value
    if (!l || empty.value || fromServer.value || !(holeRatio.value > 0)) return null
    return { left: l.cx, top: l.cy, width: l.radius * holeRatio.value * 2 * 0.8 }
  }),
  // the pie's default slot
  center: () => pie.value?.center(),
  toggle,
  isolate,
  hint: computed(() => messages.value.legendHint),
  focus: (index) => (focused.value = index),
  data: dataLabels,
  dataShown: computed(() => labelsShown.value),
  dataFocus: computed(() => (pie.value ? null : (focused.value ?? pointed.value))),
  markers: markerLabels,
  empty: computed(() => empty.value && !props.loading),
  emptyContent: () => (slots.empty?.() as VNodeChild) ?? messages.value.empty,
  loading: computed(() => !!props.loading),
}

/* the range strip: all of x, small, with the part shown */

const stripState = computed(() => {
  const l = layout.value
  if (!l?.strip || !rangePart.value) return null
  const [f0, f1] = l.x.full
  const [d0, d1] = l.x.scale.domain
  const span = f1 - f0 || 1
  return {
    rect: l.strip,
    horizontal: !!props.horizontal,
    from: Math.max(0, (d0 - f0) / span),
    to: Math.min(1, (d1 - f0) / span),
  }
})

/**
 * What the strip's sketch is drawn from: its box, all of x and each y axis'
 * whole span. Kept the same object while they stay, so panning, which only
 * moves the shown part, doesn't draw the sketch again.
 */
interface StripSketch {
  rect: Rect
  x: Window
  y: Record<string, { full: Window; log: boolean }>
}

const sameWindow = (a: Window, b: Window) => a[0] === b[0] && a[1] === b[1]

const stripSketch = computed<StripSketch | null>((old) => {
  const l = layout.value
  if (!l?.strip || !rangePart.value) return null
  const next: StripSketch = { rect: l.strip, x: l.x.full, y: {} }
  for (const [name, axis] of Object.entries(l.y)) {
    if (axis) next.y[name] = { full: axis.full, log: axis.scale.kind === 'log' }
  }
  if (
    old &&
    old.rect.x === next.rect.x &&
    old.rect.y === next.rect.y &&
    old.rect.width === next.rect.width &&
    old.rect.height === next.rect.height &&
    sameWindow(old.x, next.x) &&
    Object.keys(old.y).length === Object.keys(next.y).length &&
    Object.entries(next.y).every(([name, axis]) => {
      const was = old.y[name]
      return !!was && was.log === axis.log && sameWindow(was.full, axis.full)
    })
  )
    return old
  return next
})

/** Draws every series shown on the strip, in one quiet ink, over all of x. */
function paintStrip(canvas: HTMLCanvasElement) {
  const sketch = stripSketch.value
  if (!sketch) return
  const strip = sketch.rect
  void themeVersion.value
  const dpr = dprNow()
  const width = Math.round(strip.width * dpr)
  const height = Math.round(strip.height * dpr)
  if (canvas.width !== width) canvas.width = width
  if (canvas.height !== height) canvas.height = height
  canvas.style.width = `${strip.width}px`
  canvas.style.height = `${strip.height}px`
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, strip.width, strip.height)
  drawStrip(ctx, sketch, dpr)
}

/** The strip's sketch, in the strip's own px. */
function drawStrip(ctx: Painter, sketch: StripSketch, dpr: number) {
  const strip = sketch.rect
  const horizontal = !!props.horizontal
  // in the strip's own px, a little in from its edges
  const pad = 4
  const plot: Rect = { x: 0, y: 0, width: strip.width, height: strip.height }
  const along: [number, number] = horizontal ? [0, strip.height] : [0, strip.width]
  const m = model.value
  const x =
    m.xKind === 'category'
      ? categoryScale(m.categories, along)
      : linearScale(sketch.x, along, m.xKind === 'time' ? 'time' : 'linear')
  const ink = resolveColor('var(--dou-chart-range-ink)')
  const length = horizontal ? strip.height : strip.width
  for (const s of series.value) {
    const axis = sketch.y[s.axis]
    if (!axis) continue
    const span: [number, number] = horizontal ? [pad, strip.width - pad] : [strip.height - pad, pad]
    // the data's own span, so the sketch fills the strip
    const data = m.y[s.axis] ?? axis.full
    const ends: Window = m.zero[s.axis]
      ? [Math.min(0, data[0]), Math.max(0, data[1])]
      : [data[0], data[1] > data[0] ? data[1] : data[0] + 1]
    const y = axis.log ? logScale(axis.full, span) : linearScale(ends, span)
    const step = m.xStep
    const band = x.kind === 'category' ? x.step : step > 0 ? step * Math.abs(x.k) : length / 8
    const view: ChartView = {
      x,
      y,
      horizontal,
      band,
      point: horizontal
        ? (v, value) => [y.map(value), x.map(v)]
        : (v, value) => [x.map(v), y.map(value)],
      plot,
      dpr,
      vector: isSvg(ctx),
      colors: colors.value,
    }
    ctx.save()
    ctx.beginPath()
    ctx.rect(0, 0, strip.width, strip.height)
    ctx.clip()
    // thin and without dots: a sketch of the data, not the data
    s.kind.draw(ctx, { ...s, color: ink, props: { ...s.props, dots: false, lineWidth: 1 } }, view)
    ctx.restore()
  }
}

const zoomLayer: ZoomLayerState = {
  brush: computed(() => brushDraft.value ?? selection.value),
  strip: stripState,
  sketch: stripSketch,
  least: computed(() => {
    const l = layout.value
    if (!l) return 0
    const span = l.x.full[1] - l.x.full[0]
    return span > 0 ? Math.min(1, leastX.value / span) : 1
  }),
  step: computed(() => {
    const l = layout.value
    const m = model.value
    if (!l || m.xKind !== 'category') return 0.01
    return 1 / Math.max(1, l.x.full[1] - l.x.full[0])
  }),
  texts: computed(() => {
    const l = layout.value
    if (!l) return ['', '']
    const m = model.value
    const [from, to] = l.x.scale.domain
    if (m.xKind === 'category') {
      const [a, b] = windowToInterval([from, to], m.xKind, m.categories)
      return [String(a), String(b)]
    }
    return [xText(from), xText(to)]
  }),
  labels: computed(() => [messages.value.rangeStart, messages.value.rangeEnd]),
  show: (from, to, settle) => {
    const l = layout.value
    if (!l) return
    const [f0, f1] = l.x.full
    const span = f1 - f0
    showX([f0 + from * span, f0 + to * span], settle)
  },
  reset: () => showX(null),
  start: () => setActive(null, null),
  paint: paintStrip,
}

/* the chart as an SVG: drawn by the same code as the canvas, with its text */

const uid = useId()
let drawings = 0

const SRGB = /^(#|rgba?\()/
let normalizer: CanvasRenderingContext2D | null | undefined

/**
 * A computed color as `#rrggbb` or `rgba(…)`, which every SVG reader
 * understands. Colors a canvas keeps in another space (`oklab(…)`) are
 * painted on a pixel and read back.
 */
function plainColor(color: string): string {
  if (SRGB.test(color) || typeof document === 'undefined') return color
  normalizer ??= document.createElement('canvas').getContext('2d', { willReadFrequently: true })
  if (!normalizer) return color
  normalizer.fillStyle = '#000'
  normalizer.fillStyle = color
  const parsed = String(normalizer.fillStyle)
  if (SRGB.test(parsed)) return parsed
  normalizer.clearRect(0, 0, 1, 1)
  normalizer.fillRect(0, 0, 1, 1)
  const [r, g, b, alpha] = normalizer.getImageData(0, 0, 1, 1).data
  return alpha === 255 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${num(alpha! / 255)})`
}

/** Room either side of a marker's label on its backdrop. */
const BACKDROP = 4

interface TextStyle {
  color: string
  size: number
  weight?: string
  anchor?: 'start' | 'middle' | 'end'
}

/** A line of text whose 16px box starts at `top`, centered on its cap height as in the page. */
function svgText(text: string, x: number, top: number, style: TextStyle): string {
  let attributes = ` x="${num(x)}" y="${num(top + 8 + style.size * 0.35)}"${paintAttribute('fill', style.color)}`
  if (style.size !== 12) attributes += ` font-size="${num(style.size)}"`
  if (style.weight && style.weight !== '400' && style.weight !== 'normal')
    attributes += ` font-weight="${style.weight}"`
  if (style.anchor && style.anchor !== 'start') attributes += ` text-anchor="${style.anchor}"`
  return `<text${attributes}>${escapeXml(text)}</text>`
}

/** `text` cut short with an ellipsis to fit `width`, as a clipped tick label shows. */
function fitText(text: string, width: number): string {
  if (measure(text) <= width) return text
  const chars = [...text]
  let end = chars.length
  while (end > 0 && measure(`${chars.slice(0, end).join('')}…`) > width) end--
  return `${chars.slice(0, end).join('')}…`
}

/** A legend entry's swatch, as the page draws it. */
function swatch(kind: string, dashed: boolean, left: number, top: number, color: string): string {
  const fill = paintAttribute('fill', color)
  const box = (x: number, y: number, width: number, height: number, r: number) =>
    `<rect x="${num(x)}" y="${num(y)}" width="${width}" height="${height}" rx="${r}"${fill}/>`
  if (kind === 'area') return box(left, top + 4, 12, 8, 2)
  if (kind === 'bar' || kind === 'pie') return box(left + 2, top + 4, 8, 8, 2)
  if (kind === 'scatter') return `<circle cx="${num(left + 6)}" cy="${num(top + 8)}" r="4"${fill}/>`
  if (dashed) return box(left, top + 7, 4, 2, 0) + box(left + 7, top + 7, 4, 2, 0)
  return box(left, top + 7, 12, 2, 1)
}

/** The texts in an element of the chart (a donut's center), where the page shows them. */
function textsIn(el: Element, origin: DOMRect, color: (css: string) => string): string {
  const out: string[] = []
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  const range = document.createRange()
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent?.trim()
    const parent = node.parentElement
    if (!text || !parent) continue
    range.selectNodeContents(node)
    const box = range.getBoundingClientRect()
    if (!box.width) continue
    const style = getComputedStyle(parent)
    const fontSize = Number.parseFloat(style.fontSize) || 12
    out.push(
      svgText(text, box.left - origin.left, box.top - origin.top + box.height / 2 - 8, {
        color: color(style.color),
        size: fontSize,
        weight: style.fontWeight,
      }),
    )
  }
  return out.join('')
}

/** A filled box; nothing when it has no room. */
const svgBox = (r: Rect, fill: string) =>
  r.width > 0 && r.height > 0
    ? `<rect x="${num(r.x)}" y="${num(r.y)}" width="${num(r.width)}" height="${num(r.height)}"${paintAttribute('fill', fill)}/>`
    : ''

/** The range strip: its sketch, the parts not shown washed out and the part shown. */
function stripMarkup(svg: SvgPainter, color: (css: string) => string, radius: number) {
  const state = stripState.value
  const sketch = stripSketch.value
  if (!state || !sketch) return
  const { rect, horizontal } = state
  const box = svgBox
  svg.raw(
    `<rect x="${num(rect.x + 0.5)}" y="${num(rect.y + 0.5)}" width="${num(rect.width - 1)}" height="${num(rect.height - 1)}" rx="${num(Math.max(0, radius - 0.5))}" fill="none"${paintAttribute('stroke', color('var(--dou-color-border-subtle)'))}/>`,
  )
  svg.raw(`<g transform="translate(${num(rect.x)} ${num(rect.y)})">`)
  svg.layer(0.56, () => drawStrip(svg, sketch, 1))
  svg.raw('</g>')
  const length = horizontal ? rect.height : rect.width
  const start = horizontal ? rect.y : rect.x
  const a = start + state.from * length
  const b = start + state.to * length
  const stretch = (from: number, to: number): Rect =>
    horizontal
      ? { x: rect.x, y: from, width: rect.width, height: to - from }
      : { x: from, y: rect.y, width: to - from, height: rect.height }
  const shade = color('color-mix(in oklab, var(--dou-chart-surface) 72%, transparent)')
  const edge = color('color-mix(in oklab, var(--dou-color-text) 32%, transparent)')
  const shown = stretch(a, b)
  svg.raw(
    box(stretch(start, a), shade) +
      box(stretch(b, start + length), shade) +
      box(shown, color('color-mix(in oklab, var(--dou-color-text) 6%, transparent)')),
  )
  const edges = horizontal
    ? [
        { x: shown.x, y: shown.y, width: 1, height: shown.height },
        { x: shown.x + shown.width - 1, y: shown.y, width: 1, height: shown.height },
      ]
    : [
        { x: shown.x, y: shown.y, width: shown.width, height: 1 },
        { x: shown.x, y: shown.y + shown.height - 1, width: shown.width, height: 1 },
      ]
  svg.raw(edges.map((r) => box(r, edge)).join(''))
}

/** The chart as it is shown, as an SVG document. */
function exportSVG(options: ChartExportOptions = {}): string {
  const root = rootRef.value
  const style = root && typeof getComputedStyle !== 'undefined' ? getComputedStyle(root) : null
  const svg = new SvgPainter(`${uid}-${drawings++}-`, plainColor)
  const color = (css: string) => plainColor(resolveColor(css))
  drawSvg(svg, color, style)
  const { width, height, padding } = exportSize(options)
  const background =
    options.background === false
      ? ''
      : `<rect width="${num(width)}" height="${num(height)}"${paintAttribute('fill', color('var(--dou-chart-surface)'))}/>`
  const font = escapeXml(style?.fontFamily || 'sans-serif')
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${num(width)}" height="${num(height)}" viewBox="0 0 ${num(width)} ${num(height)}" font-family="${font}" font-size="12">` +
    `<title>${escapeXml(label.value)}</title>${background}` +
    `<g transform="translate(${num(padding)} ${num(padding)})">${svg.markup()}</g></svg>`
  )
}

/** The exported image's size: the chart's, with the room around it. */
function exportSize(options: ChartExportOptions) {
  const padding = Math.max(0, options.padding ?? 16)
  return {
    width: (frame.value?.width ?? 0) + padding * 2,
    height: (frame.value?.height ?? 0) + padding * 2,
    padding,
  }
}

/**
 * Draws the whole chart into `svg`: what the canvas shows, then its text.
 * `color` makes a color the SVG can take; `style` is the chart's computed
 * style, `null` on the server.
 */
function drawSvg(
  svg: SvgPainter,
  color: (css: string) => string,
  style: CSSStyleDeclaration | null,
) {
  const l = frame.value
  const root = rootRef.value
  const width = l?.width ?? 0
  const height = l?.height ?? 0
  const texts: string[] = []
  if (l && empty.value) {
    // what the page shows instead: the empty message
    const text =
      root?.querySelector(`.${ns.e('empty')}`)?.textContent?.trim() || messages.value.empty
    texts.push(
      svgText(text, width / 2, height / 2 - 8, {
        color: color('var(--dou-color-text-tertiary)'),
        size: Number.parseFloat(style?.getPropertyValue('--dou-font-size-sm') ?? '') || 12,
        anchor: 'middle',
      }),
    )
  } else if (pieLayout.value) {
    paintPie(svg, 1, 1, true)
    const center = root?.querySelector(`.${ns.e('center')}`)
    if (center && root) texts.push(textsIn(center, root.getBoundingClientRect(), color))
  } else if (layout.value) {
    paint(svg, 1, 1, 1, true)
    const radius = Number.parseFloat(style?.getPropertyValue('--dou-radius-control') ?? '') || 6
    stripMarkup(svg, color, radius)
    const ink = color('var(--dou-chart-label)')
    for (const tick of labels.value) {
      const text = tick.clipped ? fitText(tick.text, tick.width) : tick.text
      texts.push(svgText(text, tick.left, tick.top, { color: ink, size: 12 }))
    }
    const title = color('var(--dou-chart-title)')
    const weight = style?.getPropertyValue('--dou-font-weight-medium').trim() || '500'
    for (const t of titles.value)
      texts.push(
        svgText(t.text, t.left, t.top, { color: title, size: 12, weight, anchor: t.align }),
      )
    for (const m of markerLabels.value) {
      if (m.backdrop) {
        // the page's 4px either side of the text, rounded
        const plate = measure(m.text) + BACKDROP * 2
        const shift =
          m.align === 'start'
            ? 0
            : m.align === 'middle'
              ? plate / 2 - BACKDROP
              : plate - BACKDROP * 2
        texts.push(
          `<rect x="${num(m.left - BACKDROP - shift)}" y="${num(m.top)}" width="${num(plate)}" height="16" rx="4"${paintAttribute('fill', color(`color-mix(in oklab, ${markerText(m.tone)} 10%, var(--dou-chart-surface))`))}/>`,
        )
      }
      texts.push(
        svgText(m.text, m.left, m.top, {
          color: color(markerText(m.tone)),
          size: 12,
          anchor: m.align,
        }),
      )
    }
  }
  // data labels, as the page shows them once they have come in
  if (l && !empty.value) {
    const ink = color('var(--dou-color-text-secondary)')
    const weight = style?.getPropertyValue('--dou-font-weight-medium').trim() || '500'
    for (const value of dataLabels.value) {
      const text = value.width === undefined ? value.text : fitText(value.text, value.width)
      texts.push(
        svgText(text, value.left, value.top, {
          color: value.ink ? color(value.ink) : ink,
          size: 12,
          anchor: value.align,
          weight: value.on ? weight : undefined,
        }),
      )
    }
  }
  const on = color('var(--dou-color-text-secondary)')
  const off = color('var(--dou-color-text-disabled)')
  // the entries in sight: where they scroll, those at the top
  const box = l?.legendBox
  for (const item of legend.value) {
    if (box && item.top + 16 > box.y + box.height + 0.5) continue
    const mark = swatch(item.kind, item.dashed, item.left, item.top, color(item.color))
    texts.push(item.off ? `<g opacity="0.32">${mark}</g>` : mark)
    const text = item.clipped ? fitText(item.text, item.width - 18) : item.text
    texts.push(svgText(text, item.left + 18, item.top, { color: item.off ? off : on, size: 12 }))
  }
  svg.raw(texts.join(''))
}

const PNG_SOURCE = { scope: '@dou-ui/chart', hint: 'use a smaller padding or exportSVG()' }

/** The chart as a PNG image, from its SVG. */
async function exportPNG(options: ChartImageOptions = {}): Promise<Blob> {
  const { width, height } = exportSize(options)
  return svgToPNG(exportSVG(options), {
    width,
    height,
    pixelRatio: options.pixelRatio,
    ...PNG_SOURCE,
  })
}

defineExpose<ChartExpose>({ exportSVG, exportPNG })

/*
 * On the server: the chart as an SVG, its text too, in the theme's
 * variables so it follows the theme like the page. It scales to fit the
 * chart's box, whose width the server can't know.
 */
const serverDrawing = computed(() => {
  if (typeof window !== 'undefined' || !frame.value || empty.value) return ''
  const svg = new SvgPainter(`${uid}-`)
  drawSvg(svg, (css) => resolveColor(css), null)
  return svg.markup()
})

const staticState: StaticState = {
  shown: computed(() => fromServer.value && !!frame.value && !empty.value),
  size: computed(() => ({ width: frame.value?.width ?? 0, height: frame.value?.height ?? 0 })),
  markup: serverDrawing,
  label,
}

/** Which ways on the screen what is shown can be moved: only when zoomed in along them. */
function panDirections() {
  const { x, y } = zoomAxes.value
  const panX = x && !!xWindow.value
  const panY = y && !!yWindow.value
  return props.horizontal ? { sideways: panY, upDown: panX } : { sideways: panX, upDown: panY }
}

/** Which way a finger may scroll the page over the plot: not the way it pans. */
const touchAction = computed(() => {
  if (!zoomOn.value) return undefined
  const { sideways, upDown } = panDirections()
  // two fingers always zoom the chart, not the page
  return sideways && upDown ? 'none' : sideways ? 'pan-y' : upDown ? 'pan-x' : 'pan-x pan-y'
})

onBeforeUnmount(() => {
  if (drag) endDrag(false)
  if (gestureFrame) cancelAnimationFrame(gestureFrame)
})

const cssLength = (value: number | string) => (typeof value === 'number' ? `${value}px` : value)
</script>

<template>
  <div
    ref="root"
    :class="[
      ns.b(),
      ns.is('interactive', interactive),
      ns.is('zoomed', zoomOn && zoomed),
      ns.is('brushing', !!brushPart && !zoomOn),
      ns.is('loading', !!loading),
      ns.is('table', table.shown.value),
    ]"
    :style="{ height: cssLength(height), touchAction }"
    :role="fromServer ? undefined : interactive || table.shown.value ? 'group' : 'img'"
    :aria-roledescription="interactive && !fromServer ? messages.chart : undefined"
    :aria-label="fromServer ? undefined : label"
    :aria-busy="loading || undefined"
    :tabindex="interactive && !fromServer ? 0 : undefined"
    @pointermove="onPointerMove"
    @pointerleave="onPointerLeave"
    @pointerdown="onPointerDown"
    @pointerup="onPointerUp"
    @pointercancel="onPointerCancel"
    @keydown="onKeydown"
    @click="onClick"
    @wheel="onWheel"
    @dblclick="onDblclick"
    @blur="active && !active.pointer && setActive(null, null)"
  >
    <div :class="ns.e('parts')" hidden><slot /></div>
    <canvas ref="canvas" :class="ns.e('canvas')" aria-hidden="true" />
    <!-- after the parts: on the server they are known only once their slot has rendered -->
    <ChartStatic :state="staticState" />
    <ChartOverlay :state="overlay" />
    <ChartZoomLayer :state="zoomLayer" />
    <ChartPointer :state="pointer" />
    <ChartTable :state="table" />
  </div>
</template>
