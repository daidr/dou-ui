<script setup>
import { ref } from 'vue'

const treeColumns = [
  { key: 'name', title: '名称', sortable: true },
  { key: 'owner', title: '负责人', width: 120 },
  { key: 'cost', title: '月费用', width: 120, align: 'end', sortable: true },
]
const treeRows = [
  {
    id: 'infra',
    name: '基础设施',
    owner: '平台组',
    cost: 4200,
    children: [
      {
        id: 'db',
        name: '数据库',
        owner: '平台组',
        cost: 2600,
        children: [
          { id: 'pg', name: 'PostgreSQL 主库', owner: '小林', cost: 1800 },
          { id: 'redis', name: 'Redis 缓存', owner: '小林', cost: 800 },
        ],
      },
      { id: 'cdn', name: '内容分发', owner: '阿周', cost: 1600 },
    ],
  },
  {
    id: 'apps',
    name: '应用',
    owner: '业务组',
    cost: 3100,
    children: [
      { id: 'web', name: '官网', owner: '阿周', cost: 900 },
      { id: 'api', name: '开放接口', owner: '小陈', cost: 2200 },
    ],
  },
]
const treeExpanded = ref(['infra'])
const treeSort = ref(null)
</script>

<template>
  <DouTable
    v-model:expanded="treeExpanded"
    v-model:sort="treeSort"
    :data="treeRows"
    :columns="treeColumns"
    row-key="id"
  />
</template>
