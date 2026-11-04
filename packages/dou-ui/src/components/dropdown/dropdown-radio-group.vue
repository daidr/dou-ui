<script setup lang="ts">
import { provide } from 'vue'
import { dropdownRadioGroupKey } from './dropdown'
import type { DropdownGroupProps, DropdownRadioGroupSlots, DropdownValue } from './dropdown'
import DropdownGroup from './dropdown-group.vue'

defineOptions({ name: 'DouDropdownRadioGroup', inheritAttrs: false })

withDefaults(defineProps<DropdownGroupProps>(), { divided: false })
const model = defineModel<DropdownValue>()
const slots = defineSlots<DropdownRadioGroupSlots>()

provide(dropdownRadioGroupKey, {
  value: () => model.value,
  pick: (value) => (model.value = value),
})
</script>

<template>
  <DropdownGroup v-bind="$attrs" :label="label" :divided="divided">
    <template v-if="slots.label" #label><slot name="label" /></template>
    <slot />
  </DropdownGroup>
</template>
