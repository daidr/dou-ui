<script setup>
import { ref } from 'vue'

const tasks = ref([
  { id: 1, title: '整理设计稿' },
  { id: 2, title: '写组件文档' },
  { id: 3, title: '补充单元测试' },
  { id: 4, title: '发布预览版' },
])
</script>

<template>
  <DouSortable v-model="tasks" style="width: 280px" :item-label="(task) => task.title">
    <template #default="{ item, index }">
      <div class="task">
        <span class="index">{{ index + 1 }}</span>
        {{ item.title }}
      </div>
    </template>
  </DouSortable>
</template>

<style scoped>
.task {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--dou-color-border);
  border-radius: var(--dou-radius-control);
  background-color: var(--dou-color-bg-surface);
  box-shadow: var(--dou-shadow-sm);
}

.index {
  width: 16px;
  color: var(--dou-color-text-secondary);
  font-variant-numeric: tabular-nums;
}
</style>
