<script setup>
import { ref } from 'vue'

const nodes = [
  { id: 'topic', label: '确定主题', status: 'done' },
  { id: 'venue', label: '预订场地', status: 'done' },
  { id: 'guests', label: '邀请嘉宾', status: 'running' },
  { id: 'poster', label: '设计海报', status: 'done' },
  { id: 'signup', label: '上线报名页', status: 'done' },
  { id: 'agenda', label: '确认议程', status: 'running' },
  { id: 'books', label: '采购书籍', status: 'running', incomplete: true },
  { id: 'promo', label: '社群宣传', status: 'running' },
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
const zoom = ref(1)
const graph = ref()
</script>

<template>
  <DouNodeGraph
    ref="graph"
    v-model:zoom="zoom"
    class="framed"
    :nodes="nodes"
    :edges="edges"
    :height="240"
    zoomable
    legend
  />
  <DouSpace>
    <DouButton size="sm" variant="outline" @click="graph.fit()">适应画布</DouButton>
    <DouButton size="sm" variant="outline" @click="graph.scrollToNode('day')">
      定位到读书会当天
    </DouButton>
    <DouText variant="secondary">缩放：{{ Math.round(zoom * 100) }}%</DouText>
  </DouSpace>
</template>

<style scoped>
.framed {
  max-width: 560px;
  border: 1px solid var(--dou-color-border);
  border-radius: var(--dou-radius-container);
}
</style>
