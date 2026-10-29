<script setup>
import { ref } from 'vue'

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
const owners = {
  perf: '林晓峰',
  security: '周启明',
  pentest: '周启明',
  intranet: '陈思远',
  public: '陈思远',
  launch: '林晓峰',
}
const statusText = {
  wait: '未开始',
  process: '进行中',
  finish: '已完成',
  error: '出错',
  blocked: '依赖项未完成',
}
const statusTone = { finish: 'success', process: 'warning', error: 'danger', blocked: 'warning' }
const current = ref('public')
</script>

<template>
  <DouFlowGraph v-model:selected="current" :nodes="nodes" :edges="edges">
    <template #detail="{ node, status }">
      <div class="detail">
        <strong class="detail__title">{{ node.label }}</strong>
        <DouTag :tone="statusTone[status] ?? 'neutral'" size="sm">
          {{ statusText[status] }}
        </DouTag>
        <DouUser v-if="owners[node.id]" :name="owners[node.id]" size="sm" />
      </div>
    </template>
  </DouFlowGraph>
  <DouText variant="secondary">选中：{{ current ?? '无' }}</DouText>
</template>

<style scoped>
.detail {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 220px;
}

.detail__title {
  flex: 1;
}
</style>
