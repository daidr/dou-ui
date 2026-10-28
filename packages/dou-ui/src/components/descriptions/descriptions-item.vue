<script setup lang="ts">
import { computed, inject } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { descriptionsKey } from './descriptions'
import type { DescriptionsItemProps, DescriptionsItemSlots } from './descriptions'

defineOptions({ name: 'DouDescriptionsItem' })

const props = withDefaults(defineProps<DescriptionsItemProps>(), { span: 1 })
defineSlots<DescriptionsItemSlots>()

const ns = useNamespace('descriptions')
const context = inject(descriptionsKey, undefined)

const style = computed(() => {
  if (props.span === 'fill') return { gridColumn: '1 / -1' }
  const columns = context?.columns.value ?? 1
  const span = Math.min(Math.max(1, Math.floor(props.span)), columns)
  return span > 1 ? { gridColumnEnd: `span ${span}` } : undefined
})
</script>

<template>
  <div :class="ns.e('item')" :style="style">
    <dt :class="ns.e('label')">
      <slot name="label">{{ label }}</slot>
    </dt>
    <dd :class="ns.e('content')">
      <slot />
    </dd>
  </div>
</template>
