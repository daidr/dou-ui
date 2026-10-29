<script setup lang="ts">
import { useNamespace } from '../../utils/namespace'
import type { LayoutSectionSlots } from './layout'

defineOptions({ name: 'DouLayoutMain' })
defineSlots<LayoutSectionSlots>()

const ns = useNamespace('layout-main')
</script>

<template>
  <main :class="ns.b()"><slot /></main>
</template>
