<script setup lang="ts">
import { useNamespace } from '../../utils/namespace'
import type { LayoutSectionSlots } from './layout'

defineOptions({ name: 'DouLayoutFooter' })
defineSlots<LayoutSectionSlots>()

const ns = useNamespace('layout-footer')
</script>

<template>
  <footer :class="ns.b()"><slot /></footer>
</template>
