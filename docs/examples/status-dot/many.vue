<script setup lang="ts">
import type { StatusDotTone } from 'dou-ui'

const states: Record<StatusDotTone, string> = {
  neutral: '离线',
  primary: '同步中',
  success: '正常',
  warning: '负载偏高',
  danger: '宕机',
}
const legend: StatusDotTone[] = ['success', 'warning', 'danger', 'neutral']

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
  // 读屏读完整的 label，悬停时 Tooltip 再给出 label 里没有的位置
  return {
    name,
    tone,
    label: `${name} ${states[tone]}`,
    detail: `上海机房 ${Math.floor(index / 16) + 1} 号机柜`,
  }
})
</script>

<template>
  <div class="rack">
    <DouTooltip v-for="node in nodes" :key="node.name" :content="node.detail">
      <DouStatusDot
        :tone="node.tone"
        :ripple="node.tone === 'danger' || node.tone === 'warning'"
        :label="node.label"
      />
    </DouTooltip>
  </div>
  <div class="legend">
    <DouStatusDot v-for="tone in legend" :key="tone" :tone="tone" size="sm">
      {{ states[tone] }}
    </DouStatusDot>
  </div>
</template>

<style scoped>
.rack {
  display: grid;
  grid-template-columns: repeat(auto-fill, 20px);
  gap: 8px;
  justify-items: center;
  align-items: center;
  width: 100%;
  max-width: 440px;
}

.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  width: 100%;
  color: var(--dou-color-text-secondary);
  font-size: var(--dou-font-size-sm);
}
</style>
