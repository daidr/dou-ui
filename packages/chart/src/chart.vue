<script setup lang="ts">
import { useElementSize, useLocale, useNamespace, useReducedMotion } from 'dou-ui'
import {
  computed,
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
import { extent, read, type ChartAccessor } from './core/data'
import { allX, angleAt, nearestPoint, nearestX, rowAt, sortedOrder } from './core/hit'
import { numberFormatFull, numberTickFormat, timeFormatFull } from './core/format'
import {
  layoutChart,
  layoutPie,
  type AxisConfig,
  type AxisLayout,
  type ChartAxes,
  type ChartAxisPosition,
  type ChartAxisRole,
  type TickLabel,
} from './core/layout'
import { buildModel, seriesName, type ChartModel, type SeriesInput } from './core/model'
import { crisp, type Painter, type Rect } from './core/painter'
import { drawPie, FADED, pieSlices, type PieSlice } from './core/pie'
import type { ChartColors, ChartHit, ChartSeries, ChartValueAxis, ChartView } from './core/series'
import {
  chartKey,
  type AxisPart,
  type ChartPart,
  type PiePart,
  type SeriesPart,
  type TooltipPart,
} from './context'
import { format, useChartMessages } from './locale'
import ChartOverlay, { type OverlayState } from './overlay.vue'
import ChartPointer, { type PointerState, type Tip } from './pointer.vue'
import type { ChartProps, ChartSlots, ChartTooltipItem } from './types'

defineOptions({ name: 'DouChart' })

const props = withDefaults(defineProps<ChartProps>(), {
  data: () => [],
  height: 320,
  // left out: shown when there is more than one series
  legend: undefined,
})
defineSlots<ChartSlots>()

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
    return slices.value.map((slice, k) => ({
      text: slice.label,
      color: sliceColors.value[k]!,
      kind: 'pie',
      dashed: false,
      off: slice.hidden,
    }))
  }
  if (!(props.legend ?? seriesParts.value.length > 1)) return []
  return seriesParts.value.map((part, index) => ({
    text: seriesName({ index, props: part.props }),
    color: seriesColor(part.props, index),
    kind: part.kind.type,
    dashed: !!part.props.dashed,
    off: part.hidden.value,
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
    return x === null ? null : { type: 'axis', x }
  }
  // the series drawn last is on top
  for (let k = series.value.length - 1; k >= 0; k--) {
    const s = series.value[k]!
    const view = viewOf(s)
    if (!view) continue
    const hit = s.kind.hit ? s.kind.hit(s, view, px, py) : nearestOf(s, view, px, py)
    if (hit) return { type: 'item', series: s.index, row: hit.index, radius: hit.radius }
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
  const t = tipOf(active.value)
  return t && active.value?.touch ? { ...t, above: true } : t
})

function tipOf(a: Active | null): Tip | null {
  if (!a || !interactive.value) return null
  if (a.type === 'slice') {
    const p = pieLayout.value
    const slice = slices.value[a.slice]
    if (!p || !slice || slice.hidden) return null
    const middle = (slice.start + slice.end) / 2
    const at = p.radius * (holeRatio.value > 0 ? (1 + holeRatio.value) / 2 : 0.6)
    return {
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
  return {
    title: xText(x),
    items,
    anchor,
    marks,
    band: crosshair && band ? across(at - room / 2, room) : undefined,
    line: crosshair && !band ? across(line, 1) : undefined,
  }
}

/** Whether x is a number worth giving as `value` (not a category's index). */
const m0x = () => model.value.xKind !== 'category'

function setActive(next: Target | null, pointer: [number, number] | null, touch = false) {
  const a = active.value
  if (!next) {
    if (a) active.value = null
    return
  }
  // the same thing under a pointer that moved: only the tooltip moves
  active.value = { ...next, pointer, touch } as Active
}

/* pointer: a mouse hovers; a finger taps, and a tap elsewhere closes */

let pointerFrame = 0
let lastPointer: [number, number] | null = null

function local(event: PointerEvent): [number, number] {
  const rect = rootRef.value!.getBoundingClientRect()
  return [event.clientX - rect.left, event.clientY - rect.top]
}

function onPointerMove(event: PointerEvent) {
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
  if (!lastPointer) return
  const [x, y] = lastPointer
  setActive(hitAt(x, y), lastPointer)
}

function onPointerLeave(event: PointerEvent) {
  if (event.pointerType === 'touch') return
  lastPointer = null
  if (active.value?.pointer) setActive(null, null)
}

let tapped = false
function onPointerDown(event: PointerEvent) {
  tapped = event.pointerType === 'touch' && interactive.value
}
function onPointerCancel() {
  // the page scrolled: not a tap
  tapped = false
}
function onPointerUp(event: PointerEvent) {
  if (!tapped) return
  tapped = false
  const at = local(event)
  setActive(hitAt(...at), at, true)
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
  if (event.key === 'Escape') {
    if (active.value) {
      setActive(null, null)
      event.stopPropagation()
    }
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
  if (next) setActive(next, null)
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

/** Read out as the keys move: the x (or series) and its values. */
const live = computed(() => {
  const t = tip.value
  if (!t || active.value?.pointer) return ''
  const items = t.items
    .map((item) => `${item.name} ${item.text}`)
    .join(messages.value.itemSeparator)
  return t.title ? `${t.title}${messages.value.itemSeparator}${items}` : items
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
  const clip = (target: Painter, s: ChartSeries) => {
    target.beginPath()
    // coming in: lines and points are drawn from the start of the x axis
    const reveal = s.kind.zero ? 1 : entering
    if (horizontal) target.rect(plot.x - 4, plot.y - 4, plot.width + 8, (plot.height + 8) * reveal)
    else target.rect(plot.x - 4, plot.y - 4, (plot.width + 8) * reveal, plot.height + 8)
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
    const title = pie.value.props.name
    return withKeys(
      format(m.summary, {
        chart: m.chart,
        series: title ? format(m.pie, { name: title, slices: list }) : list,
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
  return interactive.value ? format(messages.value.keys, { summary }) : summary
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

const cssLength = (value: number | string) => (typeof value === 'number' ? `${value}px` : value)
</script>

<template>
  <div
    ref="root"
    :class="[ns.b(), ns.is('interactive', interactive)]"
    :style="{ height: cssLength(height) }"
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
    @blur="active && !active.pointer && setActive(null, null)"
  >
    <div :class="ns.e('parts')" hidden><slot /></div>
    <canvas ref="canvas" :class="ns.e('canvas')" aria-hidden="true" />
    <ChartOverlay :state="overlay" />
    <ChartPointer :state="pointer" />
    <div v-if="empty" :class="ns.e('empty')">
      <slot name="empty">{{ messages.empty }}</slot>
    </div>
  </div>
</template>
