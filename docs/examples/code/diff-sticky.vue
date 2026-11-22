<script setup>
import { DouCodeDiff, javascript } from '@dou-ui/code'
import { ref } from 'vue'

const makeLines = (prefix, count) =>
  Array.from({ length: count }, (_, i) => `export const ${prefix}${i + 1} = ${i + 1}`).join('\n')

const files = ref([
  {
    path: 'src/shipping/fee-calculator.ts',
    from: 'src/shipping/fee.ts',
    original: `// 戴兜维护\nconst BASE_FEE = 6\nconst CITY = '上海'\nconst NOTE = '上海华东仓默认按首重计费，超出部分根据分区阶梯自动换算并保留两位小数，支持长行横向滚动查看完整说明'\n\n${makeLines('rule', 18)}\n`,
    modified: `// 戴兜维护\nconst BASE_FEE = 8\nconst CITY = '上海'\nconst REMOTE_FEE = 10\nconst NOTE = '上海华东仓默认按首重计费，超出部分根据分区阶梯自动换算并保留两位小数，支持长行横向滚动查看完整说明'\n\n${makeLines('rule', 18)}\n`,
  },
  {
    path: 'src/shipping/regions/east-china-delivery-zones.ts',
    from: '',
    original: `export const hub = '上海'\n\n${makeLines('zone', 18)}\nexport const express = false\n`,
    modified: `export const hub = '上海'\n\n${makeLines('zone', 18)}\nexport const express = true\n`,
  },
])
</script>

<template>
  <div class="demo-diff-list">
    <DouCodeDiff
      v-for="file in files"
      :key="file.path"
      v-model="file.modified"
      :original="file.original"
      :language="javascript"
      :bordered="false"
      :collapse-unchanged="false"
      :scroll-y="false"
      sticky-toolbar
      mode="inline"
      class="demo-diff-item"
    >
      <template #title>
        <span class="demo-diff-path">{{ file.path }}</span>
        <span v-if="file.from" class="demo-diff-from">← {{ file.from }}</span>
      </template>
    </DouCodeDiff>
  </div>
</template>

<style scoped>
.demo-diff-list {
  max-height: 360px;
  overflow-y: auto;
  border: 1px solid var(--dou-color-border);
  border-radius: var(--dou-radius-container);
  background-color: var(--dou-color-bg-surface);
}
.demo-diff-item + .demo-diff-item {
  border-top: 1px solid var(--dou-color-border);
}
.demo-diff-path {
  font-family: var(--dou-font-family-mono);
  color: var(--dou-color-text);
}
.demo-diff-from {
  margin-left: 6px;
  color: var(--dou-color-text-tertiary);
  font-family: var(--dou-font-family-mono);
}
</style>
