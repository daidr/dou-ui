<script setup>
import { ref } from 'vue'

const rows = [
  {
    id: 1,
    name: 'edge-fn-sh',
    region: '上海',
    status: '运行中',
    replicas: 3,
    updated: '2026-10-28 14:32',
  },
  {
    id: 2,
    name: 'api-sg',
    region: '新加坡',
    status: '运行中',
    replicas: 12,
    updated: '2026-10-28 09:15',
  },
  {
    id: 3,
    name: 'cron-fra',
    region: '法兰克福',
    status: '已停止',
    replicas: 0,
    updated: '2026-10-27 22:04',
  },
  {
    id: 4,
    name: 'image-iad',
    region: '弗吉尼亚',
    status: '部署中',
    replicas: 2,
    updated: '2026-10-28 15:01',
  },
  {
    id: 5,
    name: 'auth-sh',
    region: '上海',
    status: '运行中',
    replicas: 6,
    updated: '2026-10-26 18:40',
  },
]
const resizeColumns = [
  { key: 'name', title: '名称', width: 180 },
  { key: 'region', title: '区域', width: 140 },
  { key: 'status', title: '状态', width: 120 },
  { key: 'updated', title: '更新于' },
]
const lastResize = ref('')
</script>

<template>
  <DouTable
    :data="rows"
    :columns="resizeColumns"
    resizable
    @column-resize="(key, width) => (lastResize = `${key}：${width}px`)"
  />
  <DouText variant="secondary" size="sm">{{ lastResize || '拖动表头的右边缘试试' }}</DouText>
</template>
