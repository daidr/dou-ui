<script setup>
const nodes = [
  { id: 'a', label: '需求澄清', status: 'process' },
  { id: 'b', label: '技术方案', status: 'finish' },
  { id: 'c', label: '开发', status: 'process' },
  { id: 'd', label: '测试', status: 'process' },
]
const edges = [
  { from: 'a', to: 'c' },
  { from: 'b', to: 'c' },
  { from: 'c', to: 'd' },
]
</script>

<template>
  <DouFlowGraph :nodes="nodes" :edges="edges" auto-blocked legend />
</template>
