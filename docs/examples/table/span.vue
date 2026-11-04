<script setup>
const mergeRows = [
  { id: 1, region: '上海', name: 'edge-fn-sh', replicas: 3 },
  { id: 2, region: '上海', name: 'auth-sh', replicas: 6 },
  { id: 3, region: '上海', name: 'billing-sh', replicas: 2 },
  { id: 4, region: '新加坡', name: 'api-sg', replicas: 12 },
  { id: 5, region: '法兰克福', name: 'cron-fra', replicas: 0 },
  { id: 6, region: '法兰克福', name: 'mail-fra', replicas: 1 },
]
const mergeColumns = [
  { key: 'region', title: '区域', width: 120 },
  { key: 'name', title: '名称' },
  { key: 'replicas', title: '副本', align: 'end', width: 96 },
]
// 同一区域连续的行合并成一格
const mergeRegion = ({ row, rowIndex, columnIndex }) => {
  if (columnIndex !== 0) return
  if (rowIndex > 0 && mergeRows[rowIndex - 1].region === row.region) return [0, 0]
  let count = 1
  while (mergeRows[rowIndex + count]?.region === row.region) count++
  return [count, 1]
}
</script>

<template>
  <DouTable :data="mergeRows" :columns="mergeColumns" :span-method="mergeRegion" column-dividers />
</template>
