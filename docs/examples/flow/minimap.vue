<script setup lang="ts">
import { DouFlowControls, DouFlowEditor, DouFlowMinimap, type FlowDocument } from '@dou-ui/flow'
import { ref } from 'vue'

// Four channels, each running through the same five stages: wider than the view.
const channels = ['网页', '小程序', '邮件', '门店']
const stages = ['读取', '清洗', '去重', '统计', '导出']

const viewport = ref({ x: 40, y: 40, zoom: 1 })

const doc = ref<FlowDocument>({
  nodes: channels.flatMap((channel, row) =>
    stages.map((stage, column) => ({
      id: `${row}-${column}`,
      x: column * 240,
      y: row * 96,
      data: {
        label: `${channel} · ${stage}`,
        inputs: column ? [{ id: 'in' }] : [],
        outputs: column < stages.length - 1 ? [{ id: 'out' }] : [],
      },
    })),
  ),
  edges: channels.flatMap((_, row) =>
    stages.slice(1).map((_stage, column) => ({
      id: `${row}-${column}`,
      source: { node: `${row}-${column}`, port: 'out' },
      target: { node: `${row}-${column + 1}`, port: 'in' },
    })),
  ),
})
</script>

<template>
  <DouFlowEditor v-model="doc" v-model:viewport="viewport" aria-label="数据汇总流程">
    <DouFlowControls />
    <DouFlowMinimap />
  </DouFlowEditor>
</template>
