<script setup>
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
</script>

<template>
  <DouNodeGraph :nodes="nodes" :edges="edges" />
</template>
