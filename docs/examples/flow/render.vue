<script setup lang="ts">
import { renderFlowSVG, type FlowDocument } from '@dou-ui/flow'
import { onMounted, ref } from 'vue'

// 两个画板，只有文档，页面上没有编辑器
const boards: { name: string; doc: FlowDocument }[] = [
  {
    name: '周报生成',
    doc: {
      version: 1,
      nodes: [
        { id: 'a', x: 0, y: 0, data: { label: '读取任务', outputs: [{ id: 'out' }] } },
        {
          id: 'b',
          x: 280,
          y: 0,
          data: {
            label: '写周报',
            status: 'done',
            inputs: [{ id: 'in' }],
            outputs: [{ id: 'out' }],
          },
        },
        { id: 'c', x: 560, y: 0, data: { label: '发给戴兜', inputs: [{ id: 'in' }] } },
      ],
      edges: [
        { id: 'e1', source: { node: 'a', port: 'out' }, target: { node: 'b', port: 'in' } },
        { id: 'e2', source: { node: 'b', port: 'out' }, target: { node: 'c', port: 'in' } },
      ],
    },
  },
  {
    name: '门店排班',
    doc: {
      version: 1,
      nodes: [
        {
          id: 'a',
          x: 0,
          y: 60,
          data: {
            label: '上海门店',
            outputs: [
              { id: 'sh', label: '静安' },
              { id: 'xh', label: '徐汇' },
            ],
          },
        },
        { id: 'b', x: 300, y: 0, data: { label: '早班', inputs: [{ id: 'in' }] } },
        { id: 'c', x: 300, y: 140, data: { label: '晚班', inputs: [{ id: 'in' }] } },
      ],
      edges: [
        { id: 'e1', source: { node: 'a', port: 'sh' }, target: { node: 'b', port: 'in' } },
        {
          id: 'e2',
          source: { node: 'a', port: 'xh' },
          target: { node: 'c', port: 'in' },
          label: '周末',
        },
      ],
    },
  },
]

const theme = ref<'light' | 'dark'>('light')
const images = ref<string[]>([])

async function draw() {
  const out: string[] = []
  // 一次画一张，画完就移除，不在页面上留下编辑器
  for (const board of boards) {
    const svg = await renderFlowSVG(board.doc, { theme: theme.value, padding: 16 })
    out.push(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`)
  }
  images.value = out
}
onMounted(draw)

function toggle() {
  theme.value = theme.value === 'light' ? 'dark' : 'light'
  void draw()
}
</script>

<template>
  <div class="demo-boards">
    <!-- each card follows its thumbnail's theme -->
    <figure
      v-for="(board, i) in boards"
      :key="board.name"
      class="demo-board"
      :data-dou-theme="theme"
    >
      <img v-if="images[i]" :src="images[i]" :alt="`${board.name}的缩略图`" />
      <figcaption>{{ board.name }}</figcaption>
    </figure>
  </div>
  <div>
    <DouButton size="sm" @click="toggle">
      {{ theme === 'light' ? '改用深色' : '改用浅色' }}
    </DouButton>
  </div>
</template>

<style scoped>
.demo-boards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 16px;
  margin-bottom: 12px;
}
.demo-board {
  margin: 0;
  background-color: var(--dou-color-bg-canvas);
  color: var(--dou-color-text);
  overflow: hidden;
  border: 1px solid var(--dou-color-border);
  border-radius: var(--dou-radius-container);
}
.demo-board img {
  display: block;
  width: 100%;
  height: 140px;
  object-fit: contain;
}
.demo-board figcaption {
  margin: 0;
  padding: 8px 12px;
  text-align: start;
  background-color: var(--dou-color-bg-surface);
  border-top: 1px solid var(--dou-color-border);
  font-size: var(--dou-font-size-sm);
}
</style>
