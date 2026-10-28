<script setup lang="ts">
import { useTemplateRef } from 'vue'

const root = useTemplateRef<HTMLElement>('root')
const text = () => root.value?.querySelector('pre')?.textContent ?? ''
</script>

<template>
  <div ref="root" class="doc-code">
    <slot />
    <DouCopyButton class="doc-code__copy" :text="text" size="sm" />
  </div>
</template>
