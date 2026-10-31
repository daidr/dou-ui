<script setup>
import { CodeText, DouCodeEditor } from '@dou-ui/code'
import { DouSpace, DouText } from 'dou-ui'
import { computed, shallowRef } from 'vue'

// 100 000 lines, about 4 MB
const lines = Array.from(
  { length: 100_000 },
  (_, i) => `export const item${i} = { id: ${i}, name: '第 ${i + 1} 项', done: ${i % 3 === 0} }`,
)
const doc = shallowRef(CodeText.of(lines))
const size = computed(() => `${doc.value.lines.toLocaleString()} 行`)
</script>

<template>
  <DouSpace direction="vertical" block>
    <DouCodeEditor v-model:doc="doc" style="height: 400px" aria-label="大文件示例" />
    <DouText variant="secondary" size="sm">{{ size }}</DouText>
  </DouSpace>
</template>
