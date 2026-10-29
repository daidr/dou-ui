<script setup>
import { ref } from 'vue'

const apps = ref([
  { id: 'mail', name: '邮件', color: '#3f56b5' },
  { id: 'calendar', name: '日历', color: '#b23a48' },
  { id: 'notes', name: '笔记', color: '#c99a2e' },
  { id: 'files', name: '文件', color: '#2e7d5b' },
  { id: 'photos', name: '相册', color: '#7a4fb5' },
  { id: 'music', name: '音乐', color: '#a8572d' },
  { id: 'maps', name: '地图', color: '#5c6670' },
  { id: 'chat', name: '消息', color: '#1f2328' },
])
</script>

<template>
  <DouSortable v-model="apps" direction="grid" class="apps" :item-label="(app) => app.name">
    <template #default="{ item }">
      <div class="app">
        <span class="icon" :style="{ backgroundColor: item.color }">{{ item.name[0] }}</span>
        {{ item.name }}
      </div>
    </template>
  </DouSortable>
</template>

<style scoped>
.apps {
  gap: 12px;
  width: 320px;
}

.app {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  width: 68px;
  padding: 8px 0;
  font-size: 12px;
}

.icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  color: #fff;
  font-size: 16px;
  font-weight: 600;
}
</style>
