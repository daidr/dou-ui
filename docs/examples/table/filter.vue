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
const filterColumns = [
  { key: 'name', title: '名称' },
  {
    key: 'region',
    title: '区域',
    filters: [
      { label: '上海', value: '上海' },
      { label: '新加坡', value: '新加坡' },
      { label: '法兰克福', value: '法兰克福' },
      { label: '弗吉尼亚', value: '弗吉尼亚' },
    ],
  },
  {
    key: 'status',
    title: '状态',
    filterMultiple: false,
    filters: [
      { label: '运行中', value: '运行中' },
      { label: '已停止', value: '已停止' },
      { label: '部署中', value: '部署中' },
    ],
  },
  {
    key: 'replicas',
    title: '副本',
    align: 'end',
    width: 120,
    filters: [{ label: '5 个以上', value: 5 }],
    filterMethod: (min, row) => row.replicas > min,
  },
]
const tableFilters = ref({ region: ['上海', '新加坡'] })
</script>

<template>
  <DouTable v-model:filters="tableFilters" :data="rows" :columns="filterColumns" />
  <DouText variant="tertiary" size="sm">{{ JSON.stringify(tableFilters) }}</DouText>
</template>
