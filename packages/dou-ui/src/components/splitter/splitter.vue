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
  watchEffect,
} from 'vue'
import { useElementSize } from '../../composables/use-element-size'
import { useNamespace } from '../../utils/namespace'
import { devWarn } from '../../utils/status-check'
import { useLocale } from '../config-provider/use-config'
import { splitterContextKey } from './context'
import type { SplitterMinSize } from './context'
import type { SplitterLimit, SplitterProps, SplitterSlots } from './splitter'

defineOptions({ name: 'DouSplitter' })

const props = withDefaults(defineProps<SplitterProps>(), {
  direction: 'horizontal',
  min: 0,
  max: 100,
  minEnd: 0,
  collapsible: false,
  step: 1,
  disabled: false,
})
const size = defineModel<number>({ default: 50 })
const collapsed = defineModel<boolean>('collapsed', { default: false })
const emit = defineEmits<{ change: [value: number] }>()
defineSlots<SplitterSlots>()

const ns = useNamespace('splitter')
const { t } = useLocale()
const startId = `dou-splitter-${useId()}-start`
const root = useTemplateRef<HTMLElement>('root')

const horizontal = computed(() => props.direction === 'horizontal')
// Kept up to date, so px limits still hold when the container resizes
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

const px = (limit: SplitterLimit) => (typeof limit === 'string' ? Number.parseFloat(limit) || 0 : 0)
// px as a percentage of the splitter, 0 until it is measured
function share(value: number) {
  const total = length()
  return total ? (value / total) * 100 : 0
}
const percent = (limit: SplitterLimit) => (typeof limit === 'number' ? limit : 0)

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
  return {
    start: Math.max(px(props.min), start[main]),
    end: Math.max(px(props.minEnd), end[main]),
    cross: Math.max(collapsed.value ? 0 : start[cross], end[cross]),
  }
})
const parent = inject(splitterContextKey, null)
let unregister: (() => void) | undefined
onMounted(() => {
  unregister = root.value
    ? parent?.register(root.value, () => {
        const { start, end, cross } = needs.value
        const along = (collapsed.value ? 0 : start) + BAR + end
        return horizontal.value ? { width: along, height: cross } : { width: cross, height: along }
      })
    : undefined
})
onBeforeUnmount(() => unregister?.())

const bounds = () => {
  const min = Math.max(0, percent(props.min), share(needs.value.start))
  const end = Math.max(0, percent(props.minEnd), share(needs.value.end))
  // Too small for both minimums: they share the room in proportion
  if (min + end > 100) {
    const at = (min / (min + end)) * 100
    return { min: at, max: at }
  }
  const max = typeof props.max === 'number' ? props.max : share(px(props.max))
  return { min, max: Math.max(min, Math.min(100 - end, max)) }
}
const round = (value: number) => Math.round(value * 100) / 100
function clamp(value: number) {
  const { min, max } = bounds()
  const next = round(Math.min(max, Math.max(min, value)))
  // rounding must not push a pane below its minimum: round inwards at the limits
  if (next > max) return Math.floor(max * 100) / 100
  if (next < min) return Math.ceil(min * 100) / 100
  return next
}

function set(value: number) {
  const next = clamp(value)
  if (collapsed.value) collapsed.value = false
  if (next !== size.value) size.value = next
}

function toggle() {
  if (!props.collapsible || props.disabled) return
  collapsed.value = !collapsed.value
  emit('change', size.value)
}

/* dragging */

const dragging = ref(false)
function onPointerdown(event: PointerEvent) {
  if (props.disabled || event.button !== 0) return
  event.preventDefault()
  ;(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId)
  ;(event.currentTarget as HTMLElement).focus()
  dragging.value = true
}
function onPointermove(event: PointerEvent) {
  if (!dragging.value || !root.value) return
  const rect = root.value.getBoundingClientRect()
  const total = (horizontal.value ? rect.width : rect.height) - BAR
  if (total <= 0) return
  const at = (horizontal.value ? event.clientX - rect.left : event.clientY - rect.top) - BAR / 2
  set((at / total) * 100)
}
function onPointerup() {
  if (!dragging.value) return
  dragging.value = false
  emit('change', size.value)
}

/* keys */

function onKeydown(event: KeyboardEvent) {
  if (props.disabled) return
  const step = props.step * (event.shiftKey ? 10 : 1)
  const back = horizontal.value ? 'ArrowLeft' : 'ArrowUp'
  const forth = horizontal.value ? 'ArrowRight' : 'ArrowDown'
  const current = shown.value
  let next: number | undefined
  if (event.key === back) next = current - step
  else if (event.key === forth) next = current + step
  else if (event.key === 'Home') next = bounds().min
  else if (event.key === 'End') next = bounds().max
  else if (event.key === 'Enter' && props.collapsible) {
    event.preventDefault()
    return toggle()
  } else return
  event.preventDefault()
  set(next)
  emit('change', size.value)
}

// What is on screen: the model value kept within the limits, which can
// tighten as the container resizes. The model itself only changes when
// someone moves the divider.
const shown = computed(() => {
  if (collapsed.value) return 0
  return clamp(size.value)
})
const template = computed(
  () => `minmax(0, ${shown.value}fr) auto minmax(0, ${round(100 - shown.value)}fr)`,
)
const style = computed(() =>
  horizontal.value ? { gridTemplateColumns: template.value } : { gridTemplateRows: template.value },
)
const limits = computed(() => {
  // px limits count as 0 until the container is measured
  const { min, max } = bounds()
  return { min: Math.round(min), max: Math.round(max) }
})
</script>

<template>
  <div
    ref="root"
    :class="[
      ns.b(),
      ns.m(direction),
      ns.is('dragging', dragging),
      ns.is('collapsed', collapsed),
      ns.is('disabled', disabled),
    ]"
    :style="style"
  >
    <div ref="startPane" :id="startId" :class="[ns.e('pane'), ns.is('start', true)]">
      <slot name="start" />
    </div>
    <div
      role="separator"
      :class="ns.e('bar')"
      :tabindex="disabled ? undefined : 0"
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
    <div ref="endPane" :class="[ns.e('pane'), ns.is('end', true)]">
      <slot name="end" />
    </div>
  </div>
</template>
