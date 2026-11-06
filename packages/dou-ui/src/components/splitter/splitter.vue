<script setup lang="ts">
import { computed, ref, useId, useTemplateRef } from 'vue'
import { useElementSize } from '../../composables/use-element-size'
import { useNamespace } from '../../utils/namespace'
import { useLocale } from '../config-provider/use-config'
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
const length = () => (horizontal.value ? box.width.value : box.height.value)
function toPercent(limit: SplitterLimit) {
  if (typeof limit === 'number') return limit
  const total = length()
  return total ? (Number.parseFloat(limit) / total) * 100 : 0
}
const bounds = () => {
  const min = Math.max(0, toPercent(props.min))
  const end = Math.max(0, toPercent(props.minEnd))
  // Too narrow for both minimums: they share the room in proportion
  if (min + end > 100) {
    const at = (min / (min + end)) * 100
    return { min: at, max: at }
  }
  return { min, max: Math.max(min, Math.min(100 - end, toPercent(props.max))) }
}
const round = (value: number) => Math.round(value * 100) / 100
function clamp(value: number) {
  const { min, max } = bounds()
  return round(Math.min(max, Math.max(min, value)))
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
  const total = horizontal.value ? rect.width : rect.height
  if (!total) return
  const at = horizontal.value ? event.clientX - rect.left : event.clientY - rect.top
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
    <div :id="startId" :class="[ns.e('pane'), ns.is('start', true)]">
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
    <div :class="[ns.e('pane'), ns.is('end', true)]">
      <slot name="end" />
    </div>
  </div>
</template>
