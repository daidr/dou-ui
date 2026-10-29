<script setup>
import {
  DatabaseIcon,
  DownloadIcon,
  FileTextIcon,
  FilterIcon,
  PieChartIcon,
  BarChartIcon,
  SendIcon,
  SparkleIcon,
} from '@dou-ui/icons'

const nodes = [
  { id: 'orders', label: '拉取订单', icon: DatabaseIcon, extra: '1.2 GB', status: 'finish' },
  { id: 'logs', label: '拉取埋点日志', icon: DownloadIcon, extra: '860 MB', status: 'finish' },
  { id: 'clean', label: '清洗去重', icon: FilterIcon, extra: '12 分钟', status: 'finish' },
  {
    id: 'region',
    label: '按地区汇总',
    icon: PieChartIcon,
    extra: '4 分钟',
    status: 'process',
    progress: 70,
  },
  {
    id: 'category',
    label: '按品类汇总',
    icon: BarChartIcon,
    extra: '9 分钟',
    status: 'process',
    progress: 35,
  },
  { id: 'report', label: '生成日报', icon: FileTextIcon },
  { id: 'push', label: '推送到看板', icon: SendIcon },
]
const edges = [
  { from: 'orders', to: 'clean' },
  { from: 'logs', to: 'clean' },
  { from: 'clean', to: 'region' },
  { from: 'clean', to: 'category' },
  { from: 'region', to: 'report' },
  { from: 'category', to: 'report' },
  { from: 'report', to: 'push' },
]
</script>

<template>
  <DouFlowGraph :nodes="nodes" :edges="edges" node-width="auto">
    <template #corner="{ node }">
      <button
        type="button"
        :class="['ai-button', { 'is-done': node.status === 'finish' }]"
        :aria-label="`${node.label}：智能分析`"
      >
        <SparkleIcon />
      </button>
    </template>
  </DouFlowGraph>
</template>

<style scoped>
.ai-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: 1px solid var(--dou-color-border);
  border-radius: 50%;
  background: var(--dou-color-bg-surface);
  box-shadow: var(--dou-shadow-sm);
  color: var(--dou-color-text-tertiary);
  cursor: pointer;
}

.ai-button.is-done {
  color: var(--dou-color-success);
}

.ai-button svg {
  width: 12px;
  height: 12px;
}
</style>
