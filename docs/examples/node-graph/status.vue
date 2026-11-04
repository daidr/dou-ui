<script setup>
const nodes = [
  { id: 'a', label: '选购材料', status: 'running' },
  { id: 'b', label: '确定方案', status: 'done' },
  { id: 'c', label: '施工', status: 'running' },
  { id: 'd', label: '验收', status: 'running' },
]
const edges = [
  { from: 'a', to: 'c' },
  { from: 'b', to: 'c' },
  { from: 'c', to: 'd' },
]
</script>

<template>
  <DouNodeGraph :nodes="nodes" :edges="edges" auto-blocked legend />
</template>
