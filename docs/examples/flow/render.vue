<script setup lang="ts">
import { renderFlowSVG, type FlowDocument } from '@dou-ui/flow'
import { onMounted, ref, watch } from 'vue'

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

// 不设颜色模式时跟随页面
const mode = ref<'page' | 'light' | 'dark'>('page')
const modes = [
  { label: '跟随页面', value: 'page' },
  { label: '浅色', value: 'light' },
  { label: '深色', value: 'dark' },
]
const images = ref<string[]>([])

let latest = 0
async function draw() {
  // 连续切换时只采用最后一次的结果
  const run = ++latest
  const colorMode = mode.value === 'page' ? undefined : mode.value
  const out: string[] = []
  // 一次画一张，画完就移除，不在页面上留下编辑器
  for (const board of boards) {
    const svg = await renderFlowSVG(board.doc, { colorMode, padding: 16 })
    out.push(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`)
  }
  if (run === latest) images.value = out
}
onMounted(draw)
watch(mode, draw)
</script>

<template>
  <DouSegmentedControl
    v-model="mode"
    :options="modes"
    size="sm"
    aria-label="缩略图的颜色模式"
    class="demo-modes"
  />
  <div class="demo-boards">
    <!-- 卡片和缩略图用同一种颜色模式 -->
    <div
      v-for="(board, i) in boards"
      :key="board.name"
      class="demo-board"
      :data-dou-theme="mode === 'page' ? undefined : mode"
    >
      <img v-if="images[i]" :src="images[i]" :alt="`${board.name}的缩略图`" />
      <div class="demo-board-name">{{ board.name }}</div>
    </div>
  </div>
</template>

<style scoped>
.demo-modes {
  align-self: flex-start;
  margin-bottom: 12px;
}
.demo-boards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 16px;
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
.demo-board-name {
  /* with the 1px line above: 36px */
  padding: 7px 12px 8px;
  background-color: var(--dou-color-bg-surface);
  border-top: 1px solid var(--dou-color-border);
  color: var(--dou-color-text);
  font-size: var(--dou-font-size-sm);
  line-height: 20px;
}
</style>
