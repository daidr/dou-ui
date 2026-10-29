<script setup>
const huge = Array.from({ length: 10000 }, (_, i) => ({
  id: i + 1,
  name: `job-${String(i + 1).padStart(5, '0')}`,
  region: ['上海', '新加坡', '法兰克福', '弗吉尼亚'][i % 4],
  duration: `${(i * 37) % 600} 秒`,
}))
const hugeColumns = [
  { key: 'id', title: '#', width: 80, align: 'end' },
  { key: 'name', title: '任务', width: 180 },
  { key: 'region', title: '区域' },
  { key: 'duration', title: '耗时', width: 120, align: 'end' },
]
</script>

<template>
  <DouTable
    :data="huge"
    :columns="hugeColumns"
    row-key="id"
    virtual
    expandable
    :max-height="360"
    size="sm"
    striped
  >
    <template #expand="{ row }">
      <DouText variant="secondary" size="sm">
        {{ row.name }} 在{{ row.region }}运行了 {{ row.duration }}，日志保留 7 天。
      </DouText>
    </template>
  </DouTable>
</template>
