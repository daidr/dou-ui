<script setup lang="ts">
import { provide } from 'vue'
import { dropdownRadioGroupKey } from './dropdown'
import type { DropdownRadioGroupSlots, DropdownValue } from './dropdown'

defineOptions({ name: 'DouDropdownRadioGroup' })

const model = defineModel<DropdownValue>()
defineSlots<DropdownRadioGroupSlots>()

provide(dropdownRadioGroupKey, {
  value: () => model.value,
  pick: (value) => (model.value = value),
})
</script>

<template>
  <div role="group"><slot /></div>
</template>
