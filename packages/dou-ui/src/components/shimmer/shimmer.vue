<script setup lang="ts">
import { computed } from 'vue'
import { useNamespace } from '../../utils/namespace'
import type { ShimmerProps, ShimmerSlots } from './shimmer'

defineOptions({ name: 'DouShimmer' })

const props = withDefaults(defineProps<ShimmerProps>(), {
  as: 'span',
  active: true,
})
defineSlots<ShimmerSlots>()

const ns = useNamespace('shimmer')
const style = computed(() =>
  props.duration === undefined ? undefined : { '--dou-shimmer-duration': `${props.duration}s` },
)
</script>

<template>
  <component :is="as" :class="[ns.b(), ns.is('active', active)]" :style="style">
    <slot />
  </component>
</template>
