<script setup lang="ts">
import { computed, provide, toRef, useId } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { radioGroupKey } from './radio'
import type { RadioGroupProps, RadioGroupSlots, RadioValue } from './radio'

defineOptions({ name: 'DouRadioGroup' })

const props = withDefaults(defineProps<RadioGroupProps>(), {
  disabled: false,
  direction: 'horizontal',
})
const model = defineModel<RadioValue>()
defineSlots<RadioGroupSlots>()

const ns = useNamespace('radio-group')

// Options must share a name so the browser handles arrow keys and
// keeps a single option checked.
const id = useId()
const name = computed(() => props.name ?? `dou-radio-${id}`)

provide(radioGroupKey, {
  model,
  disabled: toRef(props, 'disabled'),
  size: toRef(props, 'size'),
  name,
  select(value) {
    model.value = value
  },
})

const classes = computed(() => [ns.b(), ns.m(props.direction)])
</script>

<template>
  <div :class="classes" role="radiogroup" :aria-disabled="disabled || undefined">
    <slot />
  </div>
</template>
