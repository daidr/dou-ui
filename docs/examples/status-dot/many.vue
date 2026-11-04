<script setup lang="ts">
import type { StatusDotTone } from 'dou-ui'

const states: Record<StatusDotTone, string> = {
  neutral: '离线',
  primary: '同步中',
  success: '正常',
  warning: '负载偏高',
  danger: '宕机',
}

// 虚构的 96 个节点：大多正常，少数负载偏高或宕机
const nodes = Array.from({ length: 96 }, (_, index) => {
  const tone: StatusDotTone =
    index % 31 === 7
      ? 'danger'
      : index % 17 === 3
        ? 'warning'
        : index % 23 === 5
          ? 'neutral'
          : 'success'
  const name = `sh-${String(index + 1).padStart(2, '0')}`
  return { name, tone, label: `${name} ${states[tone]}` }
})
</script>

<template>
  <div class="rack">
    <DouStatusDot
      v-for="node in nodes"
      :key="node.name"
      :tone="node.tone"
      :ripple="node.tone === 'danger' || node.tone === 'warning'"
      :label="node.label"
      :title="node.label"
    />
  </div>
</template>

<style scoped>
.rack {
  display: grid;
  grid-template-columns: repeat(16, 20px);
  gap: 8px;
  justify-items: center;
  align-items: center;
}
</style>
