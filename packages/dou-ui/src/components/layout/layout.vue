<script setup lang="ts">
import { inject, provide, ref } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { layoutKey } from './layout'
import type { LayoutSlots } from './layout'

defineOptions({ name: 'DouLayout' })
defineSlots<LayoutSlots>()

const ns = useNamespace('layout')

// A nested layout shares the outer one's sticky header.
const parent = inject(layoutKey, null)
provide(layoutKey, parent ?? { stickyTop: ref<string>() })
</script>

<template>
  <section :class="ns.b()"><slot /></section>
</template>
