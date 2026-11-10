<script setup>
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
const wideColumns = [
  { key: 'name', title: '名称', width: 160, fixed: 'start' },
  { key: 'region', title: '区域', width: 120 },
  { key: 'runtime', title: '运行时', width: 140 },
  { key: 'cpu', title: 'CPU', width: 100, align: 'end' },
  { key: 'memory', title: '内存', width: 120, align: 'end' },
  { key: 'requests', title: '请求 / 分钟', width: 140, align: 'end' },
  { key: 'updated', title: '更新于', width: 180 },
  { key: 'actions', title: '操作', width: 88, fixed: 'end' },
]
// two rounds of the services above, enough to scroll within maxHeight
const wideRows = [...rows, ...rows].map((row, i) => ({
  ...row,
  id: i + 1,
  name: i < rows.length ? row.name : `${row.name}-2`,
  runtime: ['Node 22', 'Bun 1.4', 'Deno 2'][i % 3],
  cpu: `${(i + 1) * 0.5} 核`,
  memory: `${(i + 1) * 256} MB`,
  requests: ((i + 3) * 1234).toLocaleString('zh-CN'),
}))
</script>

<template>
  <DouTable :data="wideRows" :columns="wideColumns" selectable :max-height="280">
    <template #cell-actions>
      <DouLink href="#">详情</DouLink>
    </template>
  </DouTable>
</template>
