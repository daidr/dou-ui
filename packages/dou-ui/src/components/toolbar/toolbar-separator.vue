<script setup lang="ts">
import { inject } from 'vue'
import { useNamespace } from '../../utils/namespace'
import { toolbarKey } from './toolbar'

defineOptions({ name: 'DouToolbarSeparator' })

const ns = useNamespace('toolbar-separator')
const toolbar = inject(toolbarKey, undefined)
// A separator runs across the toolbar's direction.
const orientation = () => (toolbar?.orientation() === 'vertical' ? 'horizontal' : 'vertical')
</script>

<template>
  <div role="separator" :class="ns.b()" :aria-orientation="orientation()" />
</template>
