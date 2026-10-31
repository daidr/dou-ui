<script setup lang="ts">
import { ref } from 'vue'
import {
  DouFormBuilder,
  DouFormBuilderCanvas,
  DouFormBuilderInspector,
  DouFormBuilderPalette,
  type FormDocument,
} from '@dou-ui/form-builder'

// 默认插槽替换整个布局：这里只要字段面板、画布和属性面板，并排成两栏
const form = ref<FormDocument>({
  version: 1,
  nodes: [
    { id: 'title', type: 'input', name: 'title', label: '报修标题', required: true },
    {
      id: 'level',
      type: 'radio-group',
      name: 'level',
      label: '紧急程度',
      default: 'normal',
      props: {
        options: [
          { label: '一般', value: 'normal' },
          { label: '紧急', value: 'urgent' },
        ],
      },
    },
  ],
})
</script>

<template>
  <DouFormBuilder v-model="form" class="builder-parts">
    <div class="builder-parts__start">
      <DouFormBuilderPalette />
    </div>
    <DouFormBuilderCanvas />
    <div class="builder-parts__end">
      <DouFormBuilderInspector />
    </div>
  </DouFormBuilder>
</template>

<style scoped>
.builder-parts {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr) 260px;
  height: 520px;
}

.builder-parts__start,
.builder-parts__end {
  display: flex;
  min-height: 0;
  overflow: auto;
}

.builder-parts__start {
  border-inline-end: 1px solid var(--dou-color-border);
}

.builder-parts__end {
  border-inline-start: 1px solid var(--dou-color-border);
}
</style>
