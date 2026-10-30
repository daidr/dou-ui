<script setup>
const nodes = [
  { id: 'outline', label: '拟定大纲', description: '五个小节，已过评审', status: 'finish' },
  {
    id: 'draft',
    label: '撰写初稿',
    extra: '6/7 节',
    description: '还差“部署”一节',
    descriptionTone: 'warning',
    status: 'process',
    progress: 80,
  },
  { id: 'images', label: '准备配图', description: '截图 12 张', status: 'process' },
  { id: 'review', label: '交叉审校', description: '戴兜负责' },
  { id: 'publish', label: '发布', kind: 'milestone' },
]
const edges = [
  { from: 'outline', to: 'draft' },
  { from: 'outline', to: 'images' },
  { from: 'draft', to: 'review' },
  { from: 'images', to: 'review' },
  { from: 'review', to: 'publish' },
]
</script>

<template>
  <DouNodeGraph :nodes="nodes" :edges="edges" />
</template>
