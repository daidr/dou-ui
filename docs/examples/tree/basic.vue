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
const expanded = ref(['src', 'components'])
const selected = ref('button.vue')
</script>

<template>
  <DouTree
    v-model:expanded="expanded"
    v-model:selected="selected"
    :data="files"
    aria-label="文件"
  />
  <DouText variant="tertiary" size="sm">选中：{{ selected }}</DouText>
</template>
