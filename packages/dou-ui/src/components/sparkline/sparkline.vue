<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  useId,
  useTemplateRef,
  watch,
} from 'vue'
import { usePopup } from '../../composables/use-popup'
import { useNamespace } from '../../utils/namespace'
import { useTeleport } from '../../utils/teleport'
import { useLocale } from '../config-provider/use-config'
import {
  VIEW_HEIGHT,
  VIEW_WIDTH,
  bars,
  decimate,
  domain,
  extremes,
  linePath,
  normalize,
  runs,
  xOf,
  yOf,
} from './geometry'
import type { SparklineMarker, SparklineProps, SparklineSlots } from './sparkline'

defineOptions({ name: 'DouSparkline' })

const props = withDefaults(defineProps<SparklineProps>(), {
  data: () => [],
  type: 'line',
  tone: 'primary',
  markers: () => [],
  interactive: true,
})
defineSlots<SparklineSlots>()

const ns = useNamespace('sparkline')
const { locale, t } = useLocale()
const id = `dou-sparkline-${useId()}`

const length = (value: number | string | undefined) =>
  typeof value === 'number' ? `${value}px` : value

/* data and scale */

const data = computed(() => normalize(props.data))
const range = computed(() => extremes(data.value))
const scale = computed(() =>
  domain(range.value, { min: props.min, max: props.max, zero: props.type === 'bar' }),
)

const numberFormat = computed(
  () => new Intl.NumberFormat(locale.value.name, { maximumFractionDigits: 2 }),
)
const text = (value: number) =>
  props.format ? props.format(value) : numberFormat.value.format(value)

/* drawing */

// The drawn width, for thinning long series; a guess until it is measured.
const plotRef = useTemplateRef<HTMLElement>('plot')
const measured = ref(typeof props.width === 'number' ? props.width : 120)
let observer: ResizeObserver | undefined
onMounted(() => {
  const plot = plotRef.value
  if (!plot || typeof ResizeObserver === 'undefined') return
  measured.value = plot.clientWidth || measured.value
  observer = new ResizeObserver(([entry]) => {
    if (entry) measured.value = entry.contentRect.width || measured.value
  })
  observer.observe(plot)
})
onBeforeUnmount(() => observer?.disconnect())

const lines = computed(() => {
  if (props.type === 'bar') return []
  const count = data.value.length
  // two points per pixel column at most: more could not be told apart
  const span = count > measured.value * 2 ? Math.ceil(count / Math.max(1, measured.value)) : 1
  return runs(data.value).map((run) => {
    const points = decimate(run, span)
    return {
      xs: points.map((point) => xOf(point.index, count)),
      ys: points.map((point) => yOf(point.value, scale.value)),
    }
  })
})

const strokePath = computed(() =>
  lines.value
    .filter((line) => line.xs.length > 1)
    .map((line) => linePath(line.xs, line.ys, props.smooth))
    .join(''),
)

const areaPath = computed(() => {
  if (props.type !== 'area') return ''
  const base = Math.round(yOf(0, scale.value) * 100) / 100
  return lines.value
    .filter((line) => line.xs.length > 1)
    .map((line) => {
      const first = Math.round(line.xs[0]! * 100) / 100
      const last = Math.round(line.xs.at(-1)! * 100) / 100
      return `${linePath(line.xs, line.ys, props.smooth)}L${last} ${base}L${first} ${base}Z`
    })
    .join('')
})

/** Points with no neighbor to join, drawn as dots so they don't vanish. */
const lonely = computed(() =>
  lines.value
    .filter((line) => line.xs.length === 1)
    .map((line) => ({ x: line.xs[0]!, y: line.ys[0]! })),
)

const barSlots = computed(() => Math.max(1, Math.floor(measured.value / 2)))
const barList = computed(() =>
  props.type === 'bar' ? bars(data.value, scale.value, barSlots.value) : [],
)
const groups = computed(() => Math.min(data.value.length, barSlots.value))
/** The bar each slot shows, by slot. */
const barBySlot = computed(() => {
  const map = new Map<number, (typeof barList.value)[number]>()
  const slot = VIEW_WIDTH / Math.max(1, groups.value)
  for (const bar of barList.value) map.set(Math.floor((bar.x + bar.width / 2) / slot), bar)
  return map
})

/** Where a datum sits, as percentages of the drawing. */
function spot(index: number) {
  const value = data.value[index]?.value ?? 0
  if (props.type === 'bar') {
    const bar = barList.value.find((item) => item.index === index)
    if (bar) return { left: (bar.x + bar.width / 2) / 10, top: bar.y }
  }
  return {
    left: (xOf(index, data.value.length) / VIEW_WIDTH) * 100,
    top: (yOf(value, scale.value) / VIEW_HEIGHT) * 100,
  }
}

const markerPoints = computed(() => {
  if (props.type === 'bar') return []
  const seen = new Set<number>()
  const list: { kind: SparklineMarker; left: number; top: number }[] = []
  for (const kind of props.markers) {
    const point = range.value[kind]
    if (!point || seen.has(point.index)) continue
    seen.add(point.index)
    list.push({ kind, ...spot(point.index) })
  }
  return list
})

/* reading values */

const summary = computed(() => {
  const { count, min, max, last } = range.value
  if (!count) return t('sparkline.empty')
  return t('sparkline.summary', {
    count,
    min: text(min!.value),
    max: text(max!.value),
    last: text(last!.value),
  })
})

const active = ref<number | null>(null)
const activeDatum = computed(() => {
  const index = active.value
  const value = index === null ? null : (data.value[index]?.value ?? null)
  if (index === null || value === null) return null
  return { index, value, label: data.value[index]!.label, text: text(value) }
})
const activeSpot = computed(() => (activeDatum.value ? spot(activeDatum.value.index) : null))

/** The datum nearest to an index that has a value. */
function nearest(index: number) {
  const list = data.value
  for (let step = 0; step < list.length; step++) {
    if (list[index - step]?.value != null) return index - step
    if (list[index + step]?.value != null) return index + step
  }
  return null
}

function pick(fraction: number) {
  const share = Math.min(1, Math.max(0, fraction))
  if (props.type === 'bar') {
    const slot = Math.min(groups.value - 1, Math.floor(share * groups.value))
    return barBySlot.value.get(slot)?.index ?? null
  }
  const count = data.value.length
  return count ? nearest(Math.round(share * (count - 1))) : null
}

function onPointer(event: PointerEvent) {
  if (!props.interactive) return
  const box = plotRef.value?.getBoundingClientRect()
  if (!box?.width) return
  active.value = pick((event.clientX - box.left) / box.width)
}
const onLeave = () => {
  if (document.activeElement !== rootRef.value) active.value = null
}

/** The datums the keyboard steps through, in order. */
const stops = computed(() => {
  if (props.type === 'bar') return barList.value.map((bar) => bar.index)
  const list: number[] = []
  data.value.forEach((datum, index) => datum.value !== null && list.push(index))
  return list
})

function onKeydown(event: KeyboardEvent) {
  const list = stops.value
  if (!list.length) return
  const at = active.value === null ? -1 : list.indexOf(active.value)
  const moves: Record<string, () => number> = {
    ArrowRight: () => Math.min(list.length - 1, at + 1),
    ArrowLeft: () => (at < 0 ? list.length - 1 : Math.max(0, at - 1)),
    Home: () => 0,
    End: () => list.length - 1,
  }
  if (event.key in moves) {
    event.preventDefault()
    active.value = list[moves[event.key]!()]!
  } else if (event.key === 'Escape' && active.value !== null) {
    event.preventDefault()
    active.value = null
  }
}

const rootRef = useTemplateRef<HTMLElement>('root')
const onFocus = () => {
  if (active.value === null && range.value.last) active.value = stops.value.at(-1) ?? null
}
const onBlur = () => (active.value = null)

/* tooltip */

const pointRef = useTemplateRef<HTMLElement>('point')
const open = computed({
  get: () => activeDatum.value !== null,
  set: (value) => {
    if (!value) active.value = null
  },
})
const popup = usePopup({
  open,
  trigger: 'manual',
  placement: 'top',
  offset: 6,
  anchor: () => pointRef.value,
})
const { panelRef, rendered, theme, placement, panelStyle } = popup
const teleportTarget = useTeleport(() => undefined)
watch(active, (index) => index !== null && void nextTick(popup.update))

const tooltipText = computed(() => {
  const datum = activeDatum.value
  if (!datum) return ''
  return datum.label === undefined
    ? datum.text
    : t('sparkline.point', { label: datum.label, value: datum.text })
})
</script>

<template>
  <div
    ref="root"
    role="img"
    :class="[ns.b(), ns.m(type), ns.is('interactive', interactive)]"
    :style="{
      width: length(width),
      height: length(height),
      '--dou-sparkline-color': `var(--dou-color-${tone})`,
    }"
    :aria-label="summary"
    :aria-describedby="activeDatum ? id : undefined"
    :tabindex="interactive && range.count ? 0 : undefined"
    @focus="onFocus"
    @blur="onBlur"
    @keydown="interactive && onKeydown($event)"
  >
    <div
      ref="plot"
      :class="ns.e('plot')"
      @pointermove="onPointer"
      @pointerdown="onPointer"
      @pointerleave="onLeave"
    >
      <svg
        :class="ns.e('svg')"
        :viewBox="`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`"
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
      >
        <path v-if="areaPath" :class="ns.e('area')" :d="areaPath" />
        <path
          v-if="strokePath"
          :class="ns.e('line')"
          :d="strokePath"
          vector-effect="non-scaling-stroke"
        />
        <rect
          v-for="bar in barList"
          :key="bar.index"
          :class="[ns.e('bar'), ns.is('active', bar.index === active)]"
          :x="bar.x"
          :y="bar.y"
          :width="bar.width"
          :height="bar.height"
        />
      </svg>
      <span
        v-for="dot in lonely"
        :key="`${dot.x}`"
        :class="ns.e('dot')"
        :style="{ left: `${dot.x / 10}%`, top: `${dot.y}%` }"
      />
      <span
        v-for="marker in markerPoints"
        :key="marker.kind"
        :class="ns.e('marker')"
        :data-kind="marker.kind"
        :style="{ left: `${marker.left}%`, top: `${marker.top}%` }"
      />
      <span
        v-if="activeSpot"
        ref="point"
        :class="ns.e('point')"
        :style="{ left: `${activeSpot.left}%`, top: `${activeSpot.top}%` }"
      />
    </div>
    <Teleport v-if="rendered" :to="teleportTarget.to" :disabled="teleportTarget.disabled">
      <div
        v-show="open"
        :id="id"
        ref="panelRef"
        role="tooltip"
        :class="['dou-tooltip', 'dou-floating', 'is-static', ns.e('tooltip')]"
        :style="panelStyle"
        :data-placement="placement"
        :data-dou-theme="theme"
      >
        <template v-if="activeDatum">
          <slot name="tooltip" v-bind="activeDatum">{{ tooltipText }}</slot>
        </template>
      </div>
    </Teleport>
  </div>
</template>
