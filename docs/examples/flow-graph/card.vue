<script setup>
const nodes = [
  {
    id: 'ios',
    label: 'iOS 开发',
    extra: '12 人日',
    description: '设计专项优化与体验问题修复',
    descriptionTone: 'danger',
    status: 'process',
    progress: 30,
  },
  {
    id: 'contract',
    label: '财务法务正式合同确认',
    description: '金额确认后完善报价单并审批',
    status: 'process',
  },
  { id: 'plan', label: '测试计划', description: '0 个用例', status: 'wait' },
  { id: 'done', label: '准出', kind: 'milestone' },
]
const edges = [
  { from: 'ios', to: 'plan' },
  { from: 'contract', to: 'plan' },
  { from: 'plan', to: 'done' },
]
</script>

<template>
  <DouFlowGraph :nodes="nodes" :edges="edges" />
</template>
