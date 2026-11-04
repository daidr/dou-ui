<script setup lang="ts">
import { useNamespace } from '../../utils/namespace'
import type { LayoutFooterProps, LayoutSectionSlots } from './layout'

defineOptions({ name: 'DouLayoutFooter' })
withDefaults(defineProps<LayoutFooterProps>(), {
  bordered: true,
})
defineSlots<LayoutSectionSlots>()

const ns = useNamespace('layout-footer')
</script>

<template>
  <footer :class="[ns.b(), ns.is('bordered', bordered)]"><slot /></footer>
</template>
