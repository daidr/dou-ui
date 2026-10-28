<script setup lang="ts">
import { computed } from 'vue'
import { useNamespace } from '../../utils/namespace'
import type { SkeletonProps, SkeletonSlots } from './skeleton'

defineOptions({ name: 'DouSkeleton' })

const props = withDefaults(defineProps<SkeletonProps>(), {
  variant: 'text',
  lines: 1,
  loading: true,
  animated: true,
})
const slots = defineSlots<SkeletonSlots>()

const ns = useNamespace('skeleton')

const toSize = (value?: string | number) => (typeof value === 'number' ? `${value}px` : value)

const style = computed(() => {
  const width = toSize(props.width)
  const height = toSize(props.height) ?? (props.variant === 'circle' ? width : undefined)
  return { '--dou-skeleton-width': width, '--dou-skeleton-height': height }
})
const lineCount = computed(() => (props.variant === 'text' ? Math.max(1, props.lines) : 1))
</script>

<template>
  <slot v-if="!loading && slots.default" />
  <span
    v-else-if="loading"
    :class="[ns.b(), ns.m(variant), ns.is('animated', animated)]"
    :style="style"
    aria-hidden="true"
  >
    <span v-for="index in lineCount" :key="index" :class="ns.e('item')" />
  </span>
</template>
