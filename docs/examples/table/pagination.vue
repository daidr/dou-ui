<script setup>
import { computed, ref } from 'vue'

const columns = [
  { key: 'name', title: '名称', sortable: true },
  { key: 'region', title: '区域' },
  { key: 'status', title: '状态' },
  { key: 'replicas', title: '副本', align: 'end', sortable: true, width: 96 },
  { key: 'updated', title: '更新于', sortable: true, width: 160 },
]
const page = ref(1)
const many = Array.from({ length: 23 }, (_, i) => ({
  id: i + 1,
  name: `worker-${String(i + 1).padStart(2, '0')}`,
  region: ['上海', '新加坡', '法兰克福'][i % 3],
  status: '运行中',
  replicas: (i * 7) % 13,
  updated: '2026-10-28',
}))
const paged = computed(() => many.slice((page.value - 1) * 5, page.value * 5))
</script>

<template>
  <DouTable :data="paged" :columns="columns" />
  <DouPagination
    v-model:page="page"
    :page-size="5"
    :total="many.length"
    show-total
    style="align-self: flex-end"
  />
</template>
