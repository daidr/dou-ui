<script setup lang="ts">
import { DouFlowEditor, flowKit, type FlowDocument } from '@dou-ui/flow'
import { whiteboardKit } from '@dou-ui/flow/whiteboard'
import { ref } from 'vue'

const extensions = [flowKit(), whiteboardKit()]

const box = (id: string, x: number, y: number, text: string) => ({
  id,
  type: 'shape',
  x,
  y,
  width: 128,
  height: 64,
  data: { shape: 'rect', text },
})

// 选中一条连接线，用浮动工具栏换走向、线型和箭头
const doc = ref<FlowDocument>({
  version: 1,
  nodes: [
    box('plan', 0, 120, '定周末计划'),
    box('show', 260, 0, '上海看展'),
    box('food', 260, 120, '吃生煎'),
    box('walk', 260, 240, '外滩散步'),
    box('home', 520, 120, '回家'),
  ],
  edges: [
    {
      id: 'a',
      source: { node: 'plan', port: 'top' },
      target: { node: 'show', port: 'left-in' },
      data: { route: 'curve' },
    },
    {
      id: 'b',
      source: { node: 'plan', port: 'right' },
      target: { node: 'food', port: 'left-in' },
    },
    {
      id: 'c',
      source: { node: 'plan', port: 'bottom' },
      target: { node: 'walk', port: 'left-in' },
      data: { route: 'elbow', dash: 'dashed' },
      label: '天晴',
    },
    {
      id: 'd',
      source: { node: 'show', port: 'right' },
      target: { node: 'home', port: 'top-in' },
      data: { route: 'elbow', dash: 'dotted', arrow: 'none' },
    },
    {
      id: 'e',
      source: { node: 'walk', port: 'right' },
      target: { node: 'home', port: 'bottom-in' },
      data: { route: 'curve', dash: 'dash-dot', arrow: 'both' },
    },
  ],
})
</script>

<template>
  <DouFlowEditor
    v-model="doc"
    :extensions="extensions"
    fit-view
    aria-label="连接线样式示例"
    style="height: 420px"
  />
</template>
