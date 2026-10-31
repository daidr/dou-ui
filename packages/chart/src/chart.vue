<script setup lang="ts">
import { useElementSize, useLocale, useNamespace } from 'dou-ui'
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
import { extent } from './core/data'
import { numberFormatFull, numberTickFormat, timeFormatFull } from './core/format'
import {
  layoutChart,
  layoutPie,
  type AxisConfig,
  type AxisLayout,
  type ChartAxes,
  type ChartAxisPosition,
} from './core/layout'
import { buildModel, type SeriesInput } from './core/model'
import { crisp, type Painter } from './core/painter'
import { drawPie, pieSlices } from './core/pie'
import type { ChartColors, ChartSeries, ChartValueAxis, ChartView } from './core/series'
import { chartKey, type AxisPart, type ChartPart, type PiePart, type SeriesPart } from './context'
import { format, useChartMessages } from './locale'
import type { ChartProps, ChartSlots } from './types'

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
  const declared: Partial<Record<ChartAxisPosition, AxisPart['props']>> = {}
  for (const part of axisParts.value) declared[part.props.position] = part.props
  return declared
})

// with only a right axis written, series that don't say otherwise are measured on it
const defaultAxis = computed<ChartValueAxis>(() =>
  !props.horizontal && declaredAxes.value.right && !declaredAxes.value.left ? 'right' : 'left',
)

const uses = (axis: ChartValueAxis) =>
  seriesParts.value.some((part) => (part.props.axis ?? defaultAxis.value) === axis)

/** The axes by what they measure; with `horizontal`, x is drawn on the left and values at the bottom. */
const axes = computed<ChartAxes>(() => {
  const declared = declaredAxes.value
  const config = (position: ChartAxisPosition, grid: boolean): AxisConfig => {
    const given = declared[position]
    return { ...given, position, grid: given?.grid ?? grid, hidden: given?.hidden ?? false }
  }
  if (props.horizontal)
    return { x: config('left', false), left: config('bottom', true), right: null }
  const left = declared.left || uses('left') || !uses('right')
  return {
    x: config('bottom', false),
    left: left ? config('left', true) : null,
    // grid lines go with the left axis, or with the right one when it is alone
    right: declared.right || uses('right') ? config('right', !left) : null,
  }
})

const model = computed(() => {
  const inputs: SeriesInput[] = seriesParts.value.map((part, index) => ({
    index,
    kind: part.kind,
    props: part.props,
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
  return pieSlices(toRaw(part.props.data ?? props.data), part.props.value, label)
})

if (process.env.NODE_ENV !== 'production')
  watch([pieParts, seriesParts], ([pies, series]) => {
    if (pies.length > 1 || (pies.length && series.length))
      console.warn(
        '[@dou-ui/chart] a <DouChartPie> is drawn alone: other series and pies are left out.',
      )
  })

/** No series has a value to show. */
const empty = computed(() =>
  pie.value ? !slices.value.length : !model.value.y.left && !model.value.y.right,
)

// a number axis of what look like times in ms: most likely meant as a time axis
let timestampWarned = false
watch(model, (m) => {
  if (process.env.NODE_ENV === 'production' || timestampWarned) return
  if (m.xKind !== 'linear' || axes.value.x.type || !m.x) return
  if (m.x[0] > 1e11 && m.x[1] < 1e13) {
    timestampWarned = true
    console.warn(
      '[@dou-ui/chart] the x values look like times in ms. Add <DouChartAxis position="bottom" type="time" /> to show them as dates.',
    )
  }
})

const paletteColor = (index: number) => `var(--dou-color-chart-${(index % 8) + 1})`

const series = computed<ChartSeries[]>(() => {
  void themeVersion.value
  return model.value.series.map((s) => {
    const { props: p, index } = s.input
    const css = p.color ?? (p.tone ? `var(--dou-color-${p.tone})` : paletteColor(index))
    return { ...s, index, kind: s.input.kind, props: p, color: resolveColor(css) }
  })
})

const sliceColors = computed(() => {
  void themeVersion.value
  return slices.value.map((slice) => resolveColor(paletteColor(slice.index)))
})

/** The legend: one entry per series, or per slice of a pie. */
const legendEntries = computed(() => {
  if (empty.value) return []
  if (pie.value) {
    if (!(props.legend ?? slices.value.length > 1)) return []
    return slices.value.map((slice, k) => ({
      text: slice.label,
      color: sliceColors.value[k]!,
      kind: 'pie',
      dashed: false,
    }))
  }
  if (!(props.legend ?? seriesParts.value.length > 1)) return []
  return series.value.map((s) => ({
    text: s.name,
    color: s.color,
    kind: s.kind.name,
    dashed: !!s.props.dashed,
  }))
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
  ],
  request,
  { flush: 'post' },
)

function draw() {
  const canvas = canvasRef.value
  const l = layout.value ?? pieLayout.value
  if (!canvas || !l) return
  const dpr = window.devicePixelRatio || 1
  const width = Math.round(l.width * dpr)
  const height = Math.round(l.height * dpr)
  if (canvas.width !== width) canvas.width = width
  if (canvas.height !== height) canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, l.width, l.height)
  if (empty.value) return
  if (pieLayout.value) paintPie(ctx)
  else paint(ctx, dpr)
}

function paintPie(painter: Painter) {
  const l = pieLayout.value!
  drawPie(painter, slices.value, sliceColors.value, {
    cx: l.cx,
    cy: l.cy,
    radius: l.radius,
    inner: l.radius * holeRatio.value,
    surface: colors.value.surface,
  })
}

const holeRatio = computed(() => Math.min(0.95, Math.max(0, pie.value?.props.innerRadius ?? 0)))

/** Whether an axis is drawn across the chart (along the bottom), so its grid lines stand up. */
const across = (axis: AxisLayout) => axis.position === 'bottom'

function paint(painter: Painter, dpr: number) {
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
  for (const axis of [l.x, l.y.left, l.y.right]) {
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
  painter.save()
  painter.beginPath()
  painter.rect(plot.x - 4, plot.y - 4, plot.width + 8, plot.height + 8)
  painter.clip()
  const xScale = l.x.scale
  const step = model.value.xStep
  const band =
    xScale.kind === 'category'
      ? xScale.step
      : step > 0
        ? step * Math.abs(xScale.k)
        : (horizontal ? plot.height : plot.width) / 8
  for (const s of series.value) {
    const y = l.y[s.axis]
    if (!y) continue
    const view: ChartView = { x: xScale, y: y.scale, horizontal, band, plot, dpr, colors: c }
    s.kind.draw(painter, s, view)
  }
  painter.restore()

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
  const primary = l.y.left ?? l.y.right
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

/* what is read out */

const label = computed(() => {
  if (props.ariaLabel) return props.ariaLabel
  const m = messages.value
  const name = locale.value.name
  const m0 = model.value
  if (empty.value) return format(m.summary, { chart: m.chart, series: m.empty })
  if (pie.value) {
    const value = numberFormatFull(name)
    const percent = new Intl.NumberFormat(name, { style: 'percent', maximumFractionDigits: 1 })
    const list = slices.value
      .map((slice) =>
        format(m.slice, {
          label: slice.label,
          value: value(slice.value),
          share: percent.format(slice.share),
        }),
      )
      .join(m.listSeparator)
    const title = pie.value.props.name
    return format(m.summary, {
      chart: m.chart,
      series: title ? format(m.pie, { name: title, slices: list }) : list,
    })
  }
  const count = numberFormatFull(name)
  // values read the way the axis shows them
  const valueText = (axis: ChartValueAxis) => axes.value[axis]?.format ?? numberFormatFull(name)
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
    const xFormat = axes.value.x.format
    const xText = (value: number) => {
      if (m0.xKind === 'category') {
        const category = m0.categories[value] ?? ''
        return xFormat ? xFormat(category) : category
      }
      if (m0.xKind === 'time') {
        if (xFormat) return xFormat(new Date(value))
        const span = m0.x![1] - m0.x![0]
        return timeFormatFull(name, span < 2 * 86400e3 ? 'minute' : 'day')(value)
      }
      if (xFormat) return xFormat(value)
      // whole numbers on the axis (years) read as the ticks show them
      return m0.xIntegers
        ? numberTickFormat(name, m0.x!, { years: true })(value)
        : numberFormatFull(name)(value)
    }
    chart = format(m.range, { chart: m.chart, from: xText(m0.x[0]), to: xText(m0.x[1]) })
  }
  return format(m.summary, { chart, series: parts.join(m.listSeparator) })
})

const labels = computed(() => {
  const l = layout.value
  if (!l) return []
  const out: Array<{ key: string; text: string; left: number; top: number; axis: string }> = []
  for (const axis of [l.x, l.y.left, l.y.right]) {
    if (!axis) continue
    axis.labels.forEach((tick, i) =>
      out.push({
        key: `${axis.position}:${i}`,
        text: tick.text,
        left: tick.left,
        top: tick.top,
        axis: axis.position,
      }),
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
  return [l.x, l.y.left, l.y.right].flatMap((axis) =>
    axis?.title ? [{ key: axis.position, ...axis.title }] : [],
  )
})

/** The size of what is drawn: a chart with axes, or a pie. */
const frame = computed(() => layout.value ?? pieLayout.value)

/** The pie's default slot, shown in its hole. */
const PieCenter = () => pie.value?.center()

const cssLength = (value: number | string) => (typeof value === 'number' ? `${value}px` : value)
</script>

<template>
  <div
    ref="root"
    :class="ns.b()"
    :style="{ height: cssLength(height) }"
    role="img"
    :aria-label="label"
  >
    <div :class="ns.e('parts')" hidden><slot /></div>
    <canvas
      ref="canvas"
      :class="ns.e('canvas')"
      aria-hidden="true"
      :style="frame ? { width: `${frame.width}px`, height: `${frame.height}px` } : undefined"
    />
    <div v-if="frame && !empty" :class="ns.e('labels')" aria-hidden="true">
      <span
        v-for="tick in labels"
        :key="tick.key"
        :class="[ns.e('tick'), ns.is(tick.axis)]"
        :style="{ transform: `translate(${tick.left}px, ${tick.top}px)` }"
        ><span :class="ns.e('text')">{{ tick.text }}</span></span
      >
      <span
        v-for="title in titles"
        :key="title.key"
        :class="[ns.e('title'), ns.is('end', title.align === 'end')]"
        :style="{ transform: `translate(${title.left}px, ${title.top}px)` }"
        ><span :class="ns.e('text')">{{ title.text }}</span></span
      >
      <span
        v-for="item in legend"
        :key="`legend:${item.index}`"
        :class="[ns.e('legend'), ns.is(item.kind), ns.is('dashed', item.dashed)]"
        :style="{ transform: `translate(${item.left}px, ${item.top}px)` }"
        ><span :class="ns.e('swatch')" :style="{ color: item.color }" /><span
          :class="ns.e('text')"
          >{{ item.text }}</span
        ></span
      >
    </div>
    <div
      v-if="pieLayout && !empty && holeRatio > 0"
      :class="ns.e('center')"
      :style="{
        left: `${pieLayout.cx}px`,
        top: `${pieLayout.cy}px`,
        width: `${pieLayout.radius * holeRatio * 2 * 0.8}px`,
      }"
    >
      <PieCenter />
    </div>
    <div v-if="empty" :class="ns.e('empty')">
      <slot name="empty">{{ messages.empty }}</slot>
    </div>
  </div>
</template>
