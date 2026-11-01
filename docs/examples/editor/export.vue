<script setup lang="ts">
import { blocksToHTML, DouEditor, editorKit, type PartialBlock } from '@dou-ui/editor'
import { blocksToMarkdown } from '@dou-ui/editor/markdown'
import { computed, ref } from 'vue'

const extensions = [editorKit()]

const blocks = ref<PartialBlock[]>([
  { type: 'heading', props: { level: 2 }, content: '上海站活动安排' },
  {
    type: 'paragraph',
    content: [
      { type: 'text', text: '集合时间 ' },
      { type: 'text', text: '周六 9:00', marks: ['bold'] },
      { type: 'text', text: '，地点见' },
      { type: 'text', text: '地图', link: 'https://ui.daidr.me' },
      { type: 'text', text: '。' },
    ],
  },
  { type: 'checkItem', props: { checked: true }, content: '确认场地' },
  { type: 'checkItem', content: '准备物料' },
  { type: 'callout', props: { tone: 'tip' }, content: '雨天改到室内。' },
])

const formats = [
  { value: 'markdown', label: 'Markdown' },
  { value: 'html', label: 'HTML' },
]
const format = ref('markdown')

const output = computed(() =>
  format.value === 'markdown'
    ? blocksToMarkdown(blocks.value, extensions)
    : blocksToHTML(blocks.value, extensions),
)
</script>

<template>
  <DouEditor v-model="blocks" :extensions="extensions" aria-label="活动安排" />
  <DouSegmentedControl
    v-model="format"
    :options="formats"
    size="sm"
    style="align-self: flex-start"
  />
  <DouCodeBlock :code="output" :lang="format === 'markdown' ? 'md' : 'html'" :max-lines="14" />
</template>
