<script setup lang="ts">
import {
  computed,
  inject,
  onBeforeUnmount,
  onMounted,
  provide,
  ref,
  shallowReactive,
  useId,
  useTemplateRef,
  watch,
  watchEffect,
} from 'vue'
import { useElementSize } from '../../composables/use-element-size'
import { useNamespace } from '../../utils/namespace'
import { devWarn } from '../../utils/status-check'
import { useLocale } from '../config-provider/use-config'
import { splitterContextKey } from './context'
import type { SplitterMinSize } from './context'
import type { SplitterLimit, SplitterPane, SplitterProps, SplitterSlots } from './splitter'

defineOptions({ name: 'DouSplitter' })

const props = withDefaults(defineProps<SplitterProps>(), {
  direction: 'horizontal',
  unit: 'percent',
  min: 0,
  minEnd: 0,
  collapsible: false,
  singlePane: null,
  disabled: false,
})
const collapsed = defineModel<boolean>('collapsed', { default: false })
const emit = defineEmits<{
  'update:modelValue': [value: number]
  change: [value: number]
}>()
defineSlots<SplitterSlots>()

const ns = useNamespace('splitter')
const { t } = useLocale()
const startId = `dou-splitter-${useId()}-start`
const root = useTemplateRef<HTMLElement>('root')

const horizontal = computed(() => props.direction === 'horizontal')
const isPx = computed(() => props.unit === 'px')
const activeSinglePane = computed<SplitterPane | null>(() =>
  props.singlePane === 'start' || props.singlePane === 'end' ? props.singlePane : null,
)
const stepSize = computed(() => props.step ?? (isPx.value ? 10 : 1))
const localSize = ref<number | undefined>()
const currentSize = computed(() => props.modelValue ?? localSize.value ?? (isPx.value ? 240 : 50))

// Kept up to date, so px limits and px mode still hold when the container resizes
const box = useElementSize(root, { box: 'border-box' })
// the divider is a 1px line; the panes share the rest, so limits are a share of that
const BAR = 1
const length = () => Math.max(0, (horizontal.value ? box.width.value : box.height.value) - BAR)

if (process.env.NODE_ENV !== 'production')
  watchEffect(() => {
    for (const [name, limit] of [
      ['min', props.min],
      ['max', props.max],
      ['minEnd', props.minEnd],
    ] as const)
      if (typeof limit === 'string' && !/^\s*\d+(?:\.\d+)?px\s*$/.test(limit))
        devWarn(
          `[dou-ui] DouSplitter: \`${name}\` is "${limit}"; use a number for percent or a length in px such as '240px'.`,
        )
  })

const limitPx = (limit: SplitterLimit | undefined) => {
  if (typeof limit === 'string') return Number.parseFloat(limit) || 0
  if (typeof limit === 'number' && isPx.value) return limit
  return 0
}
// px as a percentage of the splitter, 0 until it is measured
function share(value: number) {
  const total = length()
  return total ? (value / total) * 100 : 0
}
const limitPercent = (limit: SplitterLimit | undefined) =>
  typeof limit === 'number' && !isPx.value ? limit : 0

/* splitters inside the panes: their px limits add up to a minimum for the pane */

const startPane = useTemplateRef<HTMLElement>('startPane')
const endPane = useTemplateRef<HTMLElement>('endPane')
const nested = shallowReactive(new Map<HTMLElement, () => SplitterMinSize>())
provide(splitterContextKey, {
  register(el, measureNeed) {
    nested.set(el, measureNeed)
    return () => nested.delete(el)
  },
})
function inside(pane: HTMLElement | null): SplitterMinSize {
  const need = { width: 0, height: 0 }
  for (const [el, measureNeed] of nested) {
    if (!pane?.contains(el)) continue
    const { width, height } = measureNeed()
    need.width = Math.max(need.width, width)
    need.height = Math.max(need.height, height)
  }
  return need
}
const needs = computed(() => {
  const main = horizontal.value ? 'width' : 'height'
  const cross = horizontal.value ? 'height' : 'width'
  const start = inside(startPane.value)
  const end = inside(endPane.value)
  const hideStart = activeSinglePane.value === 'end' || (!activeSinglePane.value && collapsed.value)
  const hideEnd = activeSinglePane.value === 'start'
  return {
    start: Math.max(limitPx(props.min), start[main]),
    end: Math.max(limitPx(props.minEnd), end[main]),
    cross: Math.max(hideStart ? 0 : start[cross], hideEnd ? 0 : end[cross]),
  }
})
const parent = inject(splitterContextKey, null)
let unregister: (() => void) | undefined
onMounted(() => {
  unregister = root.value
    ? parent?.register(root.value, () => {
        const { start, end, cross } = needs.value
        let along: number
        if (activeSinglePane.value === 'start') along = start
        else if (activeSinglePane.value === 'end') along = end
        else along = (collapsed.value ? 0 : start) + BAR + end
        return horizontal.value ? { width: along, height: cross } : { width: cross, height: along }
      })
    : undefined
})
onBeforeUnmount(() => unregister?.())

const bounds = () => {
  if (isPx.value) {
    const min = Math.max(0, needs.value.start)
    const end = Math.max(0, needs.value.end)
    const explicitMax = props.max === undefined ? Infinity : Math.max(0, limitPx(props.max))
    const total = length()
    if (total > 0) {
      // Too small for both minimums: they share the room in proportion
      if (min + end > total) {
        const at = (min / (min + end)) * total
        return { min: at, max: at }
      }
      return { min, max: Math.max(min, Math.min(total - end, explicitMax)) }
    }
    return { min, max: Math.max(min, explicitMax) }
  }
  const min = Math.max(0, limitPercent(props.min), share(needs.value.start))
  const end = Math.max(0, limitPercent(props.minEnd), share(needs.value.end))
  // Too small for both minimums: they share the room in proportion
  if (min + end > 100) {
    const at = (min / (min + end)) * 100
    return { min: at, max: at }
  }
  const max =
    props.max === undefined
      ? 100
      : typeof props.max === 'number'
        ? props.max
        : share(limitPx(props.max))
  return { min, max: Math.max(min, Math.min(100 - end, max)) }
}
const round = (value: number) => Math.round(value * 100) / 100
function clamp(value: number) {
  const { min, max } = bounds()
  const bounded = Math.min(max, Math.max(min, value))
  if (isPx.value) {
    if (Math.ceil(min) > Math.floor(max)) return round(bounded)
    const next = Math.round(bounded)
    if (next > max) return Math.floor(max)
    if (next < min) return Math.ceil(min)
    return next
  }
  const next = round(bounded)
  // rounding must not push a pane below its minimum: round inwards at the limits
  if (next > max) return Math.floor(max * 100) / 100
  if (next < min) return Math.ceil(min * 100) / 100
  return next
}

function set(value: number) {
  const next = clamp(value)
  if (collapsed.value) collapsed.value = false
  if (next !== currentSize.value) {
    localSize.value = next
    emit('update:modelValue', next)
  }
  return next
}

function toggle() {
  if (!props.collapsible || props.disabled || activeSinglePane.value) return
  collapsed.value = !collapsed.value
  emit('change', currentSize.value)
}

/* dragging */

const dragging = ref(false)
let dragValue = 0
watch(activeSinglePane, (pane) => {
  if (pane) dragging.value = false
})
function onPointerdown(event: PointerEvent) {
  if (props.disabled || activeSinglePane.value || event.button !== 0) return
  event.preventDefault()
  ;(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId)
  ;(event.currentTarget as HTMLElement).focus()
  dragValue = currentSize.value
  dragging.value = true
}
function onPointermove(event: PointerEvent) {
  if (!dragging.value || !root.value) return
  const rect = root.value.getBoundingClientRect()
  const total = (horizontal.value ? rect.width : rect.height) - BAR
  if (total <= 0) return
  const at = (horizontal.value ? event.clientX - rect.left : event.clientY - rect.top) - BAR / 2
  dragValue = set(isPx.value ? at : (at / total) * 100)
}
function onPointerup() {
  if (!dragging.value) return
  dragging.value = false
  emit('change', dragValue)
}

/* keys */

function onKeydown(event: KeyboardEvent) {
  if (props.disabled || activeSinglePane.value) return
  const step = stepSize.value * (event.shiftKey ? 10 : 1)
  const back = horizontal.value ? 'ArrowLeft' : 'ArrowUp'
  const forth = horizontal.value ? 'ArrowRight' : 'ArrowDown'
  const current = shown.value
  let next: number | undefined
  if (event.key === back) next = current - step
  else if (event.key === forth) next = current + step
  else if (event.key === 'Home') next = bounds().min
  else if (event.key === 'End') {
    const { max } = bounds()
    if (!Number.isFinite(max)) return
    next = max
  } else if (event.key === 'Enter' && props.collapsible) {
    event.preventDefault()
    return toggle()
  } else return
  event.preventDefault()
  const committed = set(next)
  emit('change', committed)
}

// What is on screen: the model value kept within the limits, which can
// tighten as the container resizes. The model itself only changes when
// someone moves the divider.
const shown = computed(() => {
  if (collapsed.value) return 0
  return clamp(currentSize.value)
})
const template = computed(() => {
  if (activeSinglePane.value) return 'minmax(0, 1fr)'
  if (isPx.value) return `${shown.value}px auto minmax(0, 1fr)`
  return `minmax(0, ${shown.value}fr) auto minmax(0, ${round(100 - shown.value)}fr)`
})
const style = computed(() =>
  horizontal.value ? { gridTemplateColumns: template.value } : { gridTemplateRows: template.value },
)
const limits = computed(() => {
  // px limits count as 0 until the container is measured in percent mode
  const { min, max } = bounds()
  return {
    min: Math.round(min),
    max: Number.isFinite(max) ? Math.round(max) : undefined,
  }
})
</script>

<template>
  <div
    ref="root"
    :class="[
      ns.b(),
      ns.m(direction),
      ns.is('dragging', dragging),
      ns.is('collapsed', collapsed && !activeSinglePane),
      ns.is('disabled', disabled),
      ns.is('single-pane', !!activeSinglePane),
      ns.is('single-start', activeSinglePane === 'start'),
      ns.is('single-end', activeSinglePane === 'end'),
    ]"
    :style="style"
  >
    <div
      ref="startPane"
      :id="startId"
      :class="[ns.e('pane'), ns.is('start', true)]"
      :hidden="activeSinglePane === 'end' || undefined"
    >
      <slot name="start" />
    </div>
    <div
      role="separator"
      :class="ns.e('bar')"
      :hidden="!!activeSinglePane || undefined"
      :tabindex="disabled || activeSinglePane ? undefined : 0"
      :aria-orientation="horizontal ? 'vertical' : 'horizontal'"
      :aria-valuenow="Math.round(shown)"
      :aria-valuemin="limits.min"
      :aria-valuemax="limits.max"
      :aria-controls="startId"
      :aria-label="ariaLabel ?? t('splitter.label')"
      :aria-disabled="disabled || undefined"
      @pointerdown="onPointerdown"
      @pointermove="onPointermove"
      @pointerup="onPointerup"
      @pointercancel="onPointerup"
      @keydown="onKeydown"
      @dblclick="toggle"
    >
      <span :class="ns.e('handle')" aria-hidden="true" />
    </div>
    <div
      ref="endPane"
      :class="[ns.e('pane'), ns.is('end', true)]"
      :hidden="activeSinglePane === 'start' || undefined"
    >
      <slot name="end" />
    </div>
  </div>
</template>
