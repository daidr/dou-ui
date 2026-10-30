<script setup>
const nodes = [
  { id: 'a', label: '选购材料', status: 'process' },
  { id: 'b', label: '确定方案', status: 'finish' },
  { id: 'c', label: '施工', status: 'process' },
  { id: 'd', label: '验收', status: 'process' },
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
