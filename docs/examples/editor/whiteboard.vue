<script setup lang="ts">
import { DouEditor, editorKit, type EditorDocument, type PartialBlock } from '@dou-ui/editor'
import { flowBlock, whiteboardBlock } from '@dou-ui/editor/flow'
import { DouSwitch } from 'dou-ui'
import { ref } from 'vue'

const extensions = [
  editorKit(),
  whiteboardBlock(),
  // 带端口节点的流程图，节点来自 flowKit()
  flowBlock({ type: 'routine', label: '流程图', height: 240 }),
]
const readonly = ref(false)

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
    { type: 'paragraph', content: '出发前的准备，用流程图记下顺序：' },
    {
      type: 'routine',
      props: {
        board: {
          version: 1,
          nodes: [
            { id: 'pack', x: 0, y: 0, data: { label: '收拾背包', outputs: [{ id: 'out' }] } },
            {
              id: 'ticket',
              x: 240,
              y: 0,
              data: { label: '取票', inputs: [{ id: 'in' }], outputs: [{ id: 'out' }] },
            },
            { id: 'metro', x: 480, y: 0, data: { label: '坐地铁去展馆', inputs: [{ id: 'in' }] } },
          ],
          edges: [
            {
              id: 'r1',
              source: { node: 'pack', port: 'out' },
              target: { node: 'ticket', port: 'in' },
            },
            {
              id: 'r2',
              source: { node: 'ticket', port: 'out' },
              target: { node: 'metro', port: 'in' },
            },
          ],
        },
      },
    },
    {
      type: 'paragraph',
      content: '下面是还没有内容的白板。输入 / 再选“白板”，可以插入新的白板。',
    },
    { type: 'whiteboard' },
  ],
})
</script>

<template>
  <DouSwitch v-model="readonly">只读</DouSwitch>
  <DouEditor v-model="doc" :extensions="extensions" :readonly="readonly" aria-label="白板块示例" />
</template>
