<script setup lang="ts">
import { DouFlowControls, DouFlowEditor, type FlowDocument } from '@dou-ui/flow'
import { ref } from 'vue'

// Three stores, each through the same steps: more than fits in view, so finding helps.
const stores = ['上海静安店', '上海徐汇店', '杭州西湖店']
const steps = ['收货', '质检', '入库', '上架']

const editor = ref<InstanceType<typeof DouFlowEditor>>()
const doc = ref<FlowDocument>({
  version: 1,
  nodes: stores.flatMap((store, row) =>
    steps.map((step, column) => ({
      id: `${row}-${column}`,
      x: column * 240,
      y: row * 96,
      data: {
        label: `${store} · ${step}`,
        inputs: column ? [{ id: 'in' }] : [],
        outputs: column < steps.length - 1 ? [{ id: 'out' }] : [],
      },
    })),
  ),
  edges: stores.flatMap((_, row) =>
    steps.slice(1).map((_step, column) => ({
      id: `${row}-${column}`,
      source: { node: `${row}-${column}`, port: 'out' },
      target: { node: `${row}-${column + 1}`, port: 'in' },
    })),
  ),
})
</script>

<template>
  <DouFlowEditor ref="editor" v-model="doc" aria-label="门店收货流程">
    <DouFlowControls />
  </DouFlowEditor>
  <DouButton style="align-self: flex-start" @click="editor?.openSearch({ search: '质检' })"
    >查找“质检”</DouButton
  >
</template>
