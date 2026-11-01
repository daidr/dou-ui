<script setup lang="ts">
import { DouEditor, type PartialBlock } from '@dou-ui/editor'
import { ref } from 'vue'

const blocks = ref<PartialBlock[]>([
  {
    type: 'heading',
    props: { level: 2, align: 'center' },
    content: '上海周末市集',
  },
  {
    type: 'paragraph',
    props: { align: 'center' },
    content: [{ type: 'text', text: '本周六 10:00–18:00 · 徐汇滨江', color: 'gray' }],
  },
  {
    type: 'paragraph',
    content: [
      { type: 'text', text: '今年新增了' },
      { type: 'text', text: '旧书摊位', highlight: 'yellow' },
      { type: 'text', text: '和' },
      { type: 'text', text: '手冲咖啡', highlight: 'green' },
      { type: 'text', text: '。下雨时活动改到室内，' },
      { type: 'text', text: '请以当天通知为准', color: 'red', marks: ['bold'] },
      { type: 'text', text: '。' },
    ],
  },
  {
    type: 'quote',
    props: { align: 'right' },
    content: [{ type: 'text', text: '—— 主办方 戴兜', color: 'blue' }],
  },
])
</script>

<template>
  <DouEditor v-model="blocks" aria-label="活动通知" />
</template>
