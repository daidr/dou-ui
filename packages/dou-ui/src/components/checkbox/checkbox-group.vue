<script setup lang="ts">
import { computed, provide, toRef } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { checkboxGroupKey } from './checkbox'
import type { CheckboxGroupProps, CheckboxGroupSlots, CheckboxValue } from './checkbox'

defineOptions({ name: 'DouCheckboxGroup' })

const props = withDefaults(defineProps<CheckboxGroupProps>(), {
  disabled: false,
  direction: 'horizontal',
})
const model = defineModel<CheckboxValue[]>({ default: () => [] })
defineSlots<CheckboxGroupSlots>()

const ns = useNamespace('checkbox-group')

provide(checkboxGroupKey, {
  model,
  disabled: toRef(props, 'disabled'),
  size: toRef(props, 'size'),
  name: toRef(props, 'name'),
  toggle(value, checked) {
    const rest = model.value.filter((item) => item !== value)
    model.value = checked ? [...rest, value] : rest
  },
})

const classes = computed(() => [ns.b(), ns.m(props.direction)])
</script>

<template>
  <div :class="classes" role="group">
    <slot />
  </div>
</template>
