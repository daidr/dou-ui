<script setup>
import { FileIcon, FolderIcon } from '@dou-ui/icons'

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
</script>

<template>
  <DouTree :data="files" :default-expand-all="true" aria-label="文件">
    <template #node="{ node, expanded }">
      <DouIcon :size="14" style="color: var(--dou-color-text-tertiary)">
        <FolderIcon v-if="node.children" />
        <FileIcon v-else />
      </DouIcon>
      <span>{{ node.label }}</span>
      <DouText v-if="node.children" variant="tertiary" size="sm">
        {{ node.children.length }}
      </DouText>
    </template>
  </DouTree>
</template>
