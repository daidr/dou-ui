<script setup>
import {
  BarChartIcon,
  ClipboardCheckIcon,
  CodeIcon,
  ListChecksIcon,
  PackageIcon,
  RocketIcon,
  SparkleIcon,
} from '@dou-ui/icons'

const nodes = [
  { id: 'entry', label: '测试准入', icon: ClipboardCheckIcon, extra: '281.73M', status: 'finish' },
  { id: 'gen', label: '用例物料生成', icon: PackageIcon, extra: '50.56M', status: 'finish' },
  { id: 'check', label: '用例物料校验', icon: PackageIcon, extra: '5.87M', status: 'finish' },
  { id: 'publish', label: '用例发布', icon: RocketIcon, extra: '19.26M', status: 'finish' },
  {
    id: 'api',
    label: '接口增量自动化生成与执行',
    icon: CodeIcon,
    extra: '26.24M',
    status: 'process',
    progress: 64,
  },
  {
    id: 'regress',
    label: '接口回归自动化执行',
    icon: CodeIcon,
    extra: '38.11M',
    status: 'process',
    progress: 22,
  },
  { id: 'coverage', label: '增量代码测试覆盖率', icon: BarChartIcon },
  { id: 'result', label: '测试执行结果', icon: ListChecksIcon },
]
const edges = [
  { from: 'entry', to: 'gen' },
  { from: 'gen', to: 'check' },
  { from: 'check', to: 'publish' },
  { from: 'publish', to: 'api' },
  { from: 'publish', to: 'regress' },
  { from: 'api', to: 'coverage' },
  { from: 'regress', to: 'coverage' },
  { from: 'coverage', to: 'result' },
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
