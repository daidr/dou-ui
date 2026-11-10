<script setup lang="ts">
import { DouEditor, editorKit, type EditorDocument, type PartialBlock } from '@dou-ui/editor'
import { whiteboardBlock } from '@dou-ui/editor/flow'
import { ref } from 'vue'

const extensions = [editorKit(), whiteboardBlock()]

const doc = ref<EditorDocument<PartialBlock>>({
  version: 1,
  blocks: [
    { type: 'heading', props: { level: 2 }, content: '周末看展计划' },
    { type: 'paragraph', content: '戴兜画的安排，双击白板打开编辑。' },
    {
      type: 'whiteboard',
      props: {
        height: 320,
        board: {
          version: 1,
          nodes: [
            {
              id: 'goal',
              type: 'shape',
              x: 0,
              y: 40,
              width: 180,
              height: 96,
              data: { shape: 'ellipse', text: '周末去上海看展' },
            },
            {
              id: 'when',
              type: 'shape',
              x: 280,
              y: 28,
              width: 160,
              height: 120,
              data: { shape: 'diamond', text: '周六有空？' },
            },
            {
              id: 'book',
              type: 'shape',
              x: 540,
              y: 40,
              width: 160,
              height: 96,
              data: { shape: 'rect', text: '订周六上午的票', tone: 'success' },
            },
            {
              id: 'idea',
              type: 'sticky',
              x: 300,
              y: 220,
              width: 160,
              height: 160,
              data: { text: '顺路吃生煎' },
            },
          ],
          edges: [
            {
              id: 'e1',
              type: 'connector',
              source: { node: 'goal', port: 'right' },
              target: { node: 'when', port: 'left-in' },
            },
            {
              id: 'e2',
              type: 'connector',
              source: { node: 'when', port: 'right' },
              target: { node: 'book', port: 'left-in' },
              label: '有空',
            },
          ],
        },
      },
    },
    { type: 'paragraph', content: '输入 / 再选“白板”，可以插入新的白板。' },
  ],
})
</script>

<template>
  <DouEditor v-model="doc" :extensions="extensions" aria-label="白板块示例" />
</template>
