<script setup lang="ts">
import { computed, inject, provide, useTemplateRef } from 'vue'
import { useRovingFocus } from '../../composables/use-roving-focus'
import { useNamespace } from '../../utils/namespace'
import { toolbarKey } from '../toolbar/toolbar'
import { toggleGroupKey } from './toggle'
import type { ToggleGroupProps, ToggleGroupSlots, ToggleValue } from './toggle'

defineOptions({ name: 'DouToggleGroup' })

const props = withDefaults(defineProps<ToggleGroupProps>(), {
  modelValue: undefined,
  type: 'single',
  disabled: false,
  orientation: 'horizontal',
})
const emit = defineEmits<{
  'update:modelValue': [value: ToggleValue | ToggleValue[] | null]
  change: [value: ToggleValue | ToggleValue[] | null]
}>()
defineSlots<ToggleGroupSlots>()

const ns = useNamespace('toggle-group')
const rootRef = useTemplateRef<HTMLElement>('root')
// Inside a toolbar, the toolbar already moves focus between all its controls.
const toolbar = inject(toolbarKey, undefined)
useRovingFocus(rootRef, {
  orientation: () => props.orientation,
  enabled: () => !toolbar,
})

const pressedValues = computed<ToggleValue[]>(() => {
  const value = props.modelValue
  if (value === null || value === undefined) return []
  return Array.isArray(value) ? value : [value]
})

function toggle(value: ToggleValue) {
  const pressed = pressedValues.value.includes(value)
  let next: ToggleValue | ToggleValue[] | null
  if (props.type === 'single') next = pressed ? null : value
  else {
    next = pressed
      ? pressedValues.value.filter((item) => item !== value)
      : [...pressedValues.value, value]
  }
  emit('update:modelValue', next)
  emit('change', next)
}

provide(toggleGroupKey, {
  isPressed: (value) => pressedValues.value.includes(value),
  toggle,
  variant: computed(() => props.variant),
  size: computed(() => props.size),
  disabled: computed(() => props.disabled),
})
</script>

<template>
  <div
    ref="root"
    role="group"
    :class="[ns.b(), ns.m(orientation)]"
    :aria-orientation="orientation === 'vertical' ? 'vertical' : undefined"
  >
    <slot />
  </div>
</template>
