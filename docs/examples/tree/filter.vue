<script setup>
import { ref } from 'vue'

const files = [
  {
    key: 'src',
    label: 'src',
    children: [
      {
        key: 'components',
        label: 'components',
        children: [
          { key: 'button.vue', label: 'button.vue' },
          { key: 'input.vue', label: 'input.vue' },
          { key: 'select.vue', label: 'select.vue' },
        ],
      },
      {
        key: 'composables',
        label: 'composables',
        children: [
          { key: 'use-floating.ts', label: 'use-floating.ts' },
          { key: 'use-layer.ts', label: 'use-layer.ts' },
        ],
      },
      { key: 'index.ts', label: 'index.ts' },
    ],
  },
  { key: 'package.json', label: 'package.json' },
  { key: 'README.md', label: 'README.md' },
]
const query = ref('use')
</script>

<template>
  <DouInput v-model="query" placeholder="筛选文件" clearable size="sm" style="max-width: 240px" />
  <DouTree :data="files" :filter="query" aria-label="文件" />
</template>
