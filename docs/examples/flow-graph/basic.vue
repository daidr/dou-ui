<script setup>
const nodes = [
  { id: 'start', label: '开始', status: 'finish' },
  { id: 'perf', label: '性能评估', status: 'process' },
  { id: 'review', label: '技术方案评审及接口确认', status: 'finish', incomplete: true },
  { id: 'security', label: '安全技术评审', status: 'process' },
  { id: 'fe-est', label: '前端估分', status: 'finish' },
  { id: 'be-est', label: '后端估分', status: 'finish' },
  { id: 'fe-dev', label: '前端开发', status: 'finish' },
  { id: 'be-dev', label: '后端开发', status: 'finish' },
  { id: 'joint', label: '联调', status: 'finish' },
  { id: 'pentest', label: '安全渗透测试' },
  { id: 'intranet', label: '内网发布' },
  { id: 'public', label: '外网发布' },
  { id: 'launch', label: '全量上线', kind: 'milestone' },
]
const edges = [
  { from: 'start', to: 'perf' },
  { from: 'start', to: 'review' },
  { from: 'review', to: 'security' },
  { from: 'review', to: 'fe-est' },
  { from: 'review', to: 'be-est' },
  { from: 'perf', to: 'fe-dev' },
  { from: 'fe-est', to: 'fe-dev' },
  { from: 'be-est', to: 'be-dev' },
  { from: 'fe-dev', to: 'joint' },
  { from: 'be-dev', to: 'joint' },
  { from: 'security', to: 'pentest' },
  { from: 'joint', to: 'pentest' },
  { from: 'joint', to: 'intranet' },
  { from: 'joint', to: 'public' },
  { from: 'intranet', to: 'launch' },
  { from: 'public', to: 'launch' },
]
</script>

<template>
  <DouFlowGraph :nodes="nodes" :edges="edges" />
</template>
