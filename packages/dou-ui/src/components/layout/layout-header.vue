<script setup lang="ts">
import { computed, inject, onBeforeUnmount, watchEffect } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { layoutKey } from './layout'
import type { LayoutHeaderProps, LayoutSectionSlots } from './layout'

defineOptions({ name: 'DouLayoutHeader' })

const props = withDefaults(defineProps<LayoutHeaderProps>(), {
  height: 56,
  sticky: false,
  bordered: true,
})
defineSlots<LayoutSectionSlots>()

const ns = useNamespace('layout-header')
const layout = inject(layoutKey, null)

const height = computed(() =>
  typeof props.height === 'number' ? `${props.height}px` : props.height,
)

watchEffect(() => {
  if (layout) layout.stickyTop.value = props.sticky ? height.value : undefined
})
onBeforeUnmount(() => {
  if (layout && props.sticky) layout.stickyTop.value = undefined
})
</script>

<template>
  <header
    :class="[ns.b(), ns.is('sticky', sticky), ns.is('bordered', bordered)]"
    :style="{ '--dou-layout-header-height': height }"
  >
    <slot />
  </header>
</template>
