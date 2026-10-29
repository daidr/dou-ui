<script setup lang="ts">
import { computed, provide } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { fieldGroupKey } from './field-group'
import type { FieldGroupProps, FieldGroupSlots } from './field-group'

defineOptions({ name: 'DouFieldGroup' })

const props = withDefaults(defineProps<FieldGroupProps>(), {
  orientation: 'horizontal',
  block: false,
})
defineSlots<FieldGroupSlots>()

const ns = useNamespace('field-group')

provide(fieldGroupKey, { size: computed(() => props.size) })
</script>

<template>
  <div role="group" :class="[ns.b(), ns.m(orientation), ns.is('block', block)]">
    <slot />
  </div>
</template>
