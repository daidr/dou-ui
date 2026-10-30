<script setup>
import { ref } from 'vue'

const nodes = [
  { id: 'topic', label: '确定主题', status: 'finish' },
  { id: 'venue', label: '预订场地', status: 'finish' },
  { id: 'guests', label: '邀请嘉宾', status: 'process' },
  { id: 'poster', label: '设计海报', status: 'finish' },
  { id: 'signup', label: '上线报名页', status: 'finish' },
  { id: 'agenda', label: '确认议程', status: 'process' },
  { id: 'books', label: '采购书籍', status: 'process', incomplete: true },
  { id: 'promo', label: '社群宣传', status: 'process' },
  { id: 'rehearsal', label: '现场彩排' },
  { id: 'day', label: '读书会当天', kind: 'milestone' },
]
const edges = [
  { from: 'topic', to: 'venue' },
  { from: 'topic', to: 'guests' },
  { from: 'topic', to: 'poster' },
  { from: 'topic', to: 'signup' },
  { from: 'venue', to: 'agenda' },
  { from: 'guests', to: 'agenda' },
  { from: 'guests', to: 'books' },
  { from: 'poster', to: 'promo' },
  { from: 'signup', to: 'promo' },
  { from: 'agenda', to: 'rehearsal' },
  { from: 'books', to: 'rehearsal' },
  { from: 'rehearsal', to: 'day' },
  { from: 'promo', to: 'day' },
]
const owners = {
  topic: '戴兜',
  guests: '戴兜',
  agenda: '戴兜',
  books: '戴兜',
  rehearsal: '戴兜',
  day: '戴兜',
}
const statusText = {
  wait: '未开始',
  process: '进行中',
  finish: '已完成',
  error: '出错',
  blocked: '依赖项未完成',
}
const statusTone = { finish: 'success', process: 'warning', error: 'danger', blocked: 'warning' }
const current = ref('agenda')
</script>

<template>
  <DouNodeGraph v-model:selected="current" :nodes="nodes" :edges="edges">
    <template #detail="{ node, status }">
      <div class="detail">
        <strong class="detail__title">{{ node.label }}</strong>
        <DouTag :tone="statusTone[status] ?? 'neutral'" size="sm">
          {{ statusText[status] }}
        </DouTag>
        <DouUser v-if="owners[node.id]" :name="owners[node.id]" size="sm" />
      </div>
    </template>
  </DouNodeGraph>
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
