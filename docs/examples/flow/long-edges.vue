<script setup lang="ts">
import { DouFlowControls, DouFlowEditor, type FlowDocument } from '@dou-ui/flow'
import { ref } from 'vue'

// 先随手摆放，点控制栏最右边的“整理”看长连线怎么绕开节点。
const steps: [id: string, label: string, x: number, y: number][] = [
  ['clothes', '打包衣物', 0, 0],
  ['books', '打包书籍', 220, 40],
  ['kitchen', '打包厨具', 440, 0],
  ['quote', '比价搬家公司', 660, 40],
  ['packed', '打包完成', 120, 160],
  ['truck', '预约搬家车', 520, 180],
  ['move', '搬运当天', 300, 300],
  ['clean', '打扫新家', 80, 420],
  ['pay', '结清尾款', 560, 400],
  ['settle', '入住', 300, 540],
]
const links: [from: string, to: string][] = [
  ['clothes', 'packed'],
  ['books', 'packed'],
  ['kitchen', 'packed'],
  ['quote', 'truck'],
  ['quote', 'pay'],
  ['packed', 'move'],
  ['truck', 'move'],
  ['move', 'clean'],
  ['move', 'pay'],
  ['clean', 'settle'],
  ['pay', 'settle'],
]

const doc = ref<FlowDocument>({
  version: 1,
  nodes: steps.map(([id, label, x, y]) => ({
    id,
    x,
    y,
    width: 160,
    data: {
      label,
      inputs: [{ id: 'in', side: 'top', max: Infinity }],
      outputs: [{ id: 'out', side: 'bottom' }],
    },
  })),
  edges: links.map(([from, to]) => ({
    id: `${from}-${to}`,
    source: { node: from, port: 'out' },
    target: { node: to, port: 'in' },
  })),
})
</script>

<template>
  <DouFlowEditor
    v-model="doc"
    direction="vertical"
    fit-view
    aria-label="搬家计划"
    style="height: 480px"
  >
    <DouFlowControls />
  </DouFlowEditor>
</template>
