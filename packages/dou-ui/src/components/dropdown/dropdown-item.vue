<script setup lang="ts">
import { computed, inject } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { dropdownKey } from './dropdown'
import type { DropdownItemProps, DropdownItemSlots } from './dropdown'

defineOptions({ name: 'DouDropdownItem' })

const props = withDefaults(defineProps<DropdownItemProps>(), {
  disabled: false,
  tone: 'neutral',
  divided: false,
})
const emit = defineEmits<{ click: [event: MouseEvent] }>()
const slots = defineSlots<DropdownItemSlots>()

const ns = useNamespace('dropdown')
const dropdown = inject(dropdownKey, null)

const classes = computed(() => [ns.e('item'), ns.m(props.tone), ns.is('disabled', props.disabled)])

function onClick(event: MouseEvent) {
  if (props.disabled) return
  emit('click', event)
  dropdown?.select(props.value)
}

// The pointer and the keyboard share one highlight: the focused item.
function onPointermove(event: PointerEvent) {
  const item = event.currentTarget as HTMLElement
  if (!props.disabled && document.activeElement !== item) item.focus({ preventScroll: true })
}
function onPointerleave(event: PointerEvent) {
  const item = event.currentTarget as HTMLElement
  if (document.activeElement === item) item.closest<HTMLElement>('[role="menu"]')?.focus()
}
</script>

<template>
  <div v-if="divided" role="separator" :class="ns.e('separator')" />
  <div
    role="menuitem"
    tabindex="-1"
    :class="classes"
    :aria-disabled="disabled || undefined"
    @click="onClick"
    @pointermove="onPointermove"
    @pointerleave="onPointerleave"
  >
    <span v-if="slots.prefix" :class="ns.e('prefix')"><slot name="prefix" /></span>
    <span :class="ns.e('label')"><slot /></span>
    <span v-if="slots.suffix" :class="ns.e('suffix')"><slot name="suffix" /></span>
  </div>
</template>
