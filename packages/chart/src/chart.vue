<script setup lang="ts">
import {
  holdPointer,
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
  useTemplateRef,
  watch,
} from 'vue'
import { createColorResolver, observeTheme } from './core/colors'
import { extent, read, type ChartAccessor, type ChartRow } from './core/data'
import { allX, angleAt, nearestPoint, nearestX, rowAt, sortedOrder } from './core/hit'
import { numberFormatFull, numberTickFormat, timeFormatFull } from './core/format'
import {
  layoutChart,
  layoutPie,
  type AxisConfig,
  type AxisLayout,
  type ChartAxes,
  type ChartLayout,
  type ChartAxisPosition,
  type ChartAxisRole,
  type TickLabel,
} from './core/layout'
import {
  buildModel,
  seriesName,
  smallestGap,
  type ChartModel,
  type SeriesInput,
} from './core/model'
import { crisp, type Painter, type Rect } from './core/painter'
import { drawPie, FADED, pieSlices, type PieSlice } from './core/pie'
import { categoryScale, linearScale, logScale, type Scale } from './core/scale'
import type { ChartColors, ChartHit, ChartSeries, ChartValueAxis, ChartView } from './core/series'
import {
  clampWindow,
  intervalToWindow,
  panWindow,
  snapCategories,
  unitsOf,
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
  type PiePart,
  type SeriesPart,
  type RangePart,
  type TooltipPart,
  type ZoomPart,
} from './context'
import { format, useChartMessages } from './locale'
import ChartOverlay, { type OverlayState } from './overlay.vue'
import ChartPointer, { type PointerState, type Tip } from './pointer.vue'
import ChartZoomLayer, { type ZoomLayerState } from './zoom-layer.vue'
import type {
  ChartBrushEvent,
  ChartInterval,
  ChartProps,
  ChartSelectEvent,
  ChartSlots,
  ChartTooltipItem,
} from './types'

defineOptions({ name: 'DouChart' })

const props = withDefaults(defineProps<ChartProps>(), {
  data: () => [],
  height: 320,
  // left out: shown when there is more than one series
  legend: undefined,
})
defineSlots<ChartSlots>()
const emit = defineEmits<{
  /** A bar, point or slice was clicked, or Enter pressed on it: what the tooltip shows there. */
  select: [event: ChartSelectEvent]
}>()

const ns = useNamespace('chart')
const { locale } = useLocale()
const messages = useChartMessages(() => props.messages)

const rootRef = useTemplateRef<HTMLElement>('root')
const canvasRef = useTemplateRef<HTMLCanvasElement>('canvas')
const size = useElementSize(rootRef)

/* the parts written inside the chart, in the order they are written */

const seriesParts = shallowRef<SeriesPart[]>([])
const axisParts = shallowRef<AxisPart[]>([])
const pieParts = shallowRef<PiePart[]>([])
const tooltipParts = shallowRef<TooltipPart[]>([])
const zoomParts = shallowRef<ZoomPart[]>([])
const brushParts = shallowRef<BrushPart[]>([])
const rangeParts = shallowRef<RangePart[]>([])

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
onMounted(() => {
  readTheme()
  stopTheme = observeTheme(readTheme)
})
onBeforeUnmount(() => stopTheme?.())

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
    const { for: _, ...given } = declared[role] ?? ({} as Partial<AxisPart['props']>)
    const position = places[role]
    return { ...given, position, grid: given.grid ?? grid, hidden: given.hidden ?? false }
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
  return buildModel(inputs, {
    data: toRaw(props.data),
    x: props.x,
    xKind: type === 'log' ? 'linear' : type,
    axis: defaultAxis.value,
  })
})

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

const paletteColor = (index: number) => `var(--dou-color-chart-${(index % 8) + 1})`

/** A series' color: its own, its tone's, or the palette's by its place among all series. */
function seriesColor(p: SeriesPart['props'], index: number): string {
  return resolveColor(p.color ?? (p.tone ? `var(--dou-color-${p.tone})` : paletteColor(index)))
}

const series = computed<ChartSeries[]>(() => {
  void themeVersion.value
  return model.value.series.map((s) => {
    const { props: p, index } = s.input
    return { ...s, index, kind: s.input.kind, props: p, color: seriesColor(p, index) }
  })
})

const TONES = new Set(['neutral', 'primary', 'success', 'warning', 'danger'])
/** The colored part of the palette: slices leave the neutral first color for "other". */
const SLICE_COLORS = 7

const sliceColors = computed(() => {
  void themeVersion.value
  return slices.value.map((slice) => {
    const own = slice.color
    // `neutral` is the palette's own gray, softer than the neutral tone
    const css = !own
      ? `var(--dou-color-chart-${(slice.index % SLICE_COLORS) + 2})`
      : own === 'neutral'
        ? 'var(--dou-color-chart-1)'
        : TONES.has(own)
          ? `var(--dou-color-${own})`
          : own
    return resolveColor(css)
  })
})

if (process.env.NODE_ENV !== 'production')
  watch(slices, (list) => {
    if (list.length > SLICE_COLORS && pie.value && pie.value.props.color === undefined)
      console.warn(
        `[@dou-ui/chart] a pie of ${list.length} slices repeats colors after ${SLICE_COLORS}: merge the small ones into one slice, or give each a \`color\`.`,
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
  const interval = next ? windowToInterval(next, m.xKind, m.categories) : null
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
  const interval: ChartInterval | null = next ? [next[0], next[1]] : null
  if (sameInterval(interval, part.y.value) && sameInterval(interval, sentY as ChartInterval | null))
    return
  sentY = interval
  part.y.value = interval
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
    zoom: { x: xWindow.value, y: zoomAxes.value.y ? yWindow.value : null },
    strip: !!rangePart.value && !empty.value,
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
  })
})

/* the tooltip: what is under the pointer, or picked with the keys */

const tooltipPart = computed(() => tooltipParts.value[0] ?? null)
/** Whether the chart follows the pointer and can be focused. */
const interactive = computed(() => !tooltipPart.value?.props.disabled && !empty.value)
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
          row: (pie.value!.props.data ?? props.data)[slice.index],
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
        text: valueText(s.axis)(y),
        value: y,
        color: s.color,
      },
    ]
    const sizeOf = s.props.size as ChartAccessor | undefined
    if (sizeOf !== undefined) {
      const value = Number(read(s.rows[a.row]!, sizeOf, a.row))
      const name =
        (s.props.sizeName as string | undefined) ?? (typeof sizeOf === 'string' ? sizeOf : '')
      if (value === value)
        items.push({ name, text: numberFormatFull(locale.value.name)(value), value })
    }
    for (const item of items) item.row = s.rows[a.row]
    // a point with a name of its own (a city) is titled by it
    const label = s.props.label as ChartAccessor | undefined
    const own = label === undefined ? null : read(s.rows[a.row]!, label, a.row)
    return {
      x: rawX(x),
      title: own == null || own === '' ? s.name : String(own),
      items,
      anchor: [left, top],
      marks: [{ left, top, color: s.color, radius: a.radius + 3, ring: true }],
    }
  }
  // every series at one x
  const x = a.x
  const at = l.x.scale.map(x)
  const items: ChartTooltipItem[] = []
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
      text: valueText(s.axis)(y),
      value: y,
      color: s.color,
      row: s.rows[row],
    })
    if (s.kind.band) band = true
    else {
      const [left, top] = view.point(x, s.top[row]!)
      marks.push({ left, top, color: s.color, radius: 4, ring: false })
    }
  }
  if (!items.length) return null
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

const instance = getCurrentInstance()
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
    if (a) active.value = null
    zoomNote.value = ''
    return
  }
  zoomNote.value = ''
  // the same thing under a pointer that moved: only the tooltip moves
  active.value = { ...next, pointer, touch } as Active
}

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
  const mode = touch
    ? zoomOn.value
      ? 'pan'
      : null
    : brush && (event.shiftKey || !zoomOn.value)
      ? 'brush'
      : zoomOn.value
        ? 'pan'
        : null
  if (!mode && !(touch && brush)) return
  const hold = holdPointer(event, rootRef.value)
  drag = { id: event.pointerId, touch, start: at, mode, moved: false, from, hold, timer: undefined }
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
    if (!d.mode) {
      // a finger that moves before it is held long enough scrolls the page
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
  const xInterval = x ? windowToInterval(x, m.xKind, m.categories) : null
  const yInterval: ChartInterval | null = y ? [y[0], y[1]] : null
  part.x.value = xInterval
  part.y.value = yInterval
  part.select({
    ...(xInterval && { x: xInterval }),
    ...(yInterval && { y: yInterval }),
    ...rowsIn(x, y),
  })
}

function clearBrush() {
  const part = brushPart.value
  if (!part || (!part.x.value && !part.y.value)) return
  part.x.value = null
  part.y.value = null
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
      rows.push(s.rows[i]!)
      all.add(s.rows[i]!)
    }
    bySeries.push({ name: s.name, rows })
  }
  return { rows: [...all], series: bySeries }
}

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
    return
  }
  // zoomed in: a sideways scroll (or Shift and the wheel) pans along x
  if (event.shiftKey && !dx) [dx, dy] = [dy, 0]
  if (!zoomed.value || !(Math.abs(dx) > Math.abs(dy))) return
  event.preventDefault()
  setActive(null, null)
  const by: [number, number] = props.horizontal ? [0, -dx] : [-dx, 0]
  onceAFrame(() => panBy(by))
}

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
  if (!t || active.value?.pointer) return ''
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
    pie.value && active.value,
  ],
  request,
  { flush: 'post' },
)

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
let watcher: IntersectionObserver | undefined
onMounted(() => {
  if (seen || !rootRef.value) return
  watcher = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return
    seen = true
    watcher?.disconnect()
    request()
  })
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
    // bars and areas grow from their base; lines come in from the start (see `paint`)
    if (!from && s.kind.zero) {
      const zero = baselineValue(s)
      const base = s.base ?? new Float64Array(s.top.length).fill(zero)
      from = { top: base, base: s.base, ends: s.stackEnds && { up: base, down: base } }
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
  const now = typeof performance === 'undefined' ? Date.now() : performance.now()
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
  // the next frame of the move
  if (done >= 1) motion = null
  else request()
}

function paintPie(painter: Painter, t: number, sweep: number) {
  const l = pieLayout.value!
  const a = active.value
  const legendFocus = focused.value === null ? undefined : slices.value[focused.value]
  const hovered = a?.type === 'slice' ? slices.value[a.slice] : undefined
  const focus = legendFocus && !legendFocus.hidden ? legendFocus : hovered
  lastSlices = shownSlicesAt(t)
  drawPie(painter, lastSlices, sliceColors.value, {
    cx: l.cx,
    cy: l.cy,
    radius: l.radius,
    inner: l.radius * holeRatio.value,
    surface: colors.value.surface,
    focus: focus?.index,
    fade: legendFocus ? FADED : 0.56,
    sweep,
  })
}

const holeRatio = computed(() => Math.min(0.95, Math.max(0, pie.value?.props.innerRadius ?? 0)))

/** Whether an axis is drawn across the chart (along the bottom or top), so its grid lines stand up. */
const across = (axis: AxisLayout) => axis.position === 'bottom' || axis.position === 'top'

/** The scales and room a series draws with. */
function viewOf(s: ChartSeries): ChartView | null {
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
  return { x: xScale, y: ys, horizontal, band, point, plot, dpr: dprNow(), colors: colors.value }
}

const dprNow = () => (typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1)

/** A canvas to draw faded series on, then onto the chart at once: a series sets its own alpha. */
let fadeLayer: HTMLCanvasElement | null = null

function paint(painter: CanvasRenderingContext2D, dpr: number, t: number, entering: number) {
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
  lastSeries = shown
  const focus = focused.value === null ? -1 : focused.value
  const fading = focus >= 0 && shown.some((s) => s.index === focus)
  for (const s of shown) {
    const view = viewOf(s)
    if (!view) continue
    if (fading && s.index !== focus) {
      const layer = fadeOn(painter, l.width, l.height, dpr)
      if (layer) {
        layer.save()
        clip(layer, s)
        s.kind.draw(layer, s, view)
        layer.restore()
        painter.save()
        painter.globalAlpha = FADED
        painter.drawImage(layer.canvas, 0, 0, l.width, l.height)
        painter.restore()
        continue
      }
    }
    painter.save()
    clip(painter, s)
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
    const span = m0.x ? m0.x[1] - m0.x[0] : 0
    return timeFormatFull(name, span < 2 * 86400e3 ? 'minute' : 'day')(value)
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
    const range = extent(s.y)
    if (!range) return format(m.seriesEmpty, { name: s.name })
    let points = 0
    for (let i = 0; i < s.y.length; i++) if (s.y[i] === s.y[i]) points++
    const text = valueText(s.axis)
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
  shown: computed(() => !!frame.value && !empty.value),
  labels,
  titles,
  legend,
  hole: computed(() => {
    const l = pieLayout.value
    if (!l || empty.value || !(holeRatio.value > 0)) return null
    return { left: l.cx, top: l.cy, width: l.radius * holeRatio.value * 2 * 0.8 }
  }),
  // the pie's default slot
  center: () => pie.value?.center(),
  toggle,
  focus: (index) => (focused.value = index),
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

/** Draws every series shown on the strip, in one quiet ink, over all of x. */
function paintStrip(canvas: HTMLCanvasElement) {
  const l = layout.value
  const strip = l?.strip
  if (!l || !strip) return
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
  const horizontal = !!props.horizontal
  // in the strip's own px, a little in from its edges
  const pad = 4
  const plot: Rect = { x: 0, y: 0, width: strip.width, height: strip.height }
  const along: [number, number] = horizontal ? [0, strip.height] : [0, strip.width]
  const m = model.value
  const x =
    m.xKind === 'category'
      ? categoryScale(m.categories, along)
      : linearScale(l.x.full, along, m.xKind === 'time' ? 'time' : 'linear')
  const ink = resolveColor('var(--dou-chart-range-ink)')
  const length = horizontal ? strip.height : strip.width
  for (const s of series.value) {
    const axis = l.y[s.axis]
    if (!axis) continue
    const span: [number, number] = horizontal ? [pad, strip.width - pad] : [strip.height - pad, pad]
    // the data's own span, so the sketch fills the strip
    const data = m.y[s.axis] ?? axis.full
    const ends: Window = m.zero[s.axis]
      ? [Math.min(0, data[0]), Math.max(0, data[1])]
      : [data[0], data[1] > data[0] ? data[1] : data[0] + 1]
    const y = axis.scale.kind === 'log' ? logScale(axis.full, span) : linearScale(ends, span)
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

/** Which way a finger may scroll the page over the plot: not the way it pans. */
const touchAction = computed(() => {
  if (!zoomOn.value) return undefined
  const { x, y } = zoomAxes.value
  const panX = x && !!xWindow.value
  const panY = y && !!yWindow.value
  const [sideways, upDown] = props.horizontal ? [panY, panX] : [panX, panY]
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
    ]"
    :style="{ height: cssLength(height), touchAction }"
    :role="interactive ? 'group' : 'img'"
    :aria-roledescription="interactive ? messages.chart : undefined"
    :aria-label="label"
    :tabindex="interactive ? 0 : undefined"
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
    <ChartOverlay :state="overlay" />
    <ChartZoomLayer :state="zoomLayer" />
    <ChartPointer :state="pointer" />
    <div v-if="empty" :class="ns.e('empty')">
      <slot name="empty">{{ messages.empty }}</slot>
    </div>
  </div>
</template>
