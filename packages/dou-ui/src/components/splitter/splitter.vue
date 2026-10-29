<script setup lang="ts">
import { computed, ref, useId, useTemplateRef } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { useLocale } from '../config-provider/use-config'
import type { SplitterLimit, SplitterProps, SplitterSlots } from './splitter'

defineOptions({ name: 'DouSplitter' })

const props = withDefaults(defineProps<SplitterProps>(), {
  direction: 'horizontal',
  min: 0,
  max: 100,
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
const length = () => {
  const rect = root.value?.getBoundingClientRect()
  return (horizontal.value ? rect?.width : rect?.height) || 0
}
function toPercent(limit: SplitterLimit) {
  if (typeof limit === 'number') return limit
  const total = length()
  return total ? (Number.parseFloat(limit) / total) * 100 : 0
}
const bounds = () => {
  const min = Math.max(0, toPercent(props.min))
  return { min, max: Math.max(min, Math.min(100, toPercent(props.max))) }
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
  const current = collapsed.value ? 0 : size.value
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

const shown = computed(() => (collapsed.value ? 0 : size.value))
const template = computed(
  () => `minmax(0, ${shown.value}fr) auto minmax(0, ${round(100 - shown.value)}fr)`,
)
const style = computed(() =>
  horizontal.value ? { gridTemplateColumns: template.value } : { gridTemplateRows: template.value },
)
const limits = computed(() => {
  // Read the px limits only once mounted; before that they count as 0.
  void size.value
  const { min, max } = root.value ? bounds() : { min: 0, max: 100 }
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
