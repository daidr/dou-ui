<script setup lang="ts">
import { defineBlock, DouEditor, starterKit } from '@dou-ui/editor'
import { StickyNoteIcon } from '@dou-ui/icons'
import { ref } from 'vue'
import CalloutBlock from './callout-block.vue'

const callout = defineBlock({
  type: 'callout',
  props: { tone: 'info' },
  component: CalloutBlock,
  menu: {
    label: '提示框',
    hint: '带图标的说明文字',
    icon: StickyNoteIcon,
    keywords: ['callout', 'tsk', 'tishikuang'],
  },
})

const extensions = [starterKit(), callout]

const blocks = ref([
  { type: 'heading', props: { level: 2 }, content: '上海博物馆东馆参观须知' },
  { type: 'paragraph', content: '戴兜整理，出发前看一遍。' },
  { type: 'callout', props: { tone: 'warning' }, content: '需要提前一天在线预约，现场不能补约。' },
  { type: 'callout', props: { tone: 'tip' }, content: '工作日上午人少，适合慢慢看青铜器展厅。' },
  { type: 'paragraph', content: '' },
])
</script>

<template>
  <DouEditor v-model="blocks" :extensions="extensions" label="参观须知" />
</template>
