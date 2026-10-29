<script setup>
import { ref } from 'vue'

const columns = [
  { key: 'title', title: '任务' },
  { key: 'owner', title: '负责人', width: 120 },
  { key: 'due', title: '截止', width: 120 },
]
const tasks = ref([
  { id: 1, title: '整理第 18 批组件的验收截图', owner: '戴兜', due: '10-30' },
  { id: 2, title: '补全表格行拖拽的文档', owner: '戴兜', due: '10-31' },
  { id: 3, title: '检查暗色主题下的投影', owner: '小林', due: '11-02' },
  { id: 4, title: '更新路线图', owner: '阿青', due: '11-04' },
])
</script>

<template>
  <DouTable v-model:data="tasks" :columns="columns" draggable />
  <DouText variant="tertiary" size="sm">
    顺序：{{ tasks.map((task) => task.id).join(' → ') }}
  </DouText>
</template>
