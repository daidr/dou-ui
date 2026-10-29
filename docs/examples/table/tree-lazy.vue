<script setup>
import { ref } from 'vue'

const treeColumns = [
  { key: 'name', title: '名称', sortable: true },
  { key: 'owner', title: '负责人', width: 120 },
  { key: 'cost', title: '月费用', width: 120, align: 'end', sortable: true },
]
const lazyRows = [
  { id: 'sh', name: '上海', owner: '平台组', cost: 5200, hasChildren: true },
  { id: 'sg', name: '新加坡', owner: '平台组', cost: 3100, hasChildren: true },
  { id: 'fra', name: '法兰克福', owner: '业务组', cost: 900 },
]
const loadChildren = (row) =>
  new Promise((resolve) =>
    setTimeout(
      () =>
        resolve([
          {
            id: `${row.id}-1`,
            name: `${row.name} 一区`,
            owner: '小林',
            cost: Math.round(row.cost * 0.6),
          },
          {
            id: `${row.id}-2`,
            name: `${row.name} 二区`,
            owner: '阿周',
            cost: Math.round(row.cost * 0.4),
          },
        ]),
      800,
    ),
  )
const lazyExpanded = ref([])
</script>

<template>
  <DouTable
    v-model:expanded="lazyExpanded"
    :data="lazyRows"
    :columns="treeColumns"
    :load="loadChildren"
  />
</template>
