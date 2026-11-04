<script setup>
import { ref } from 'vue'

const columns = [
  { key: 'name', title: '名称' },
  { key: 'region', title: '区域' },
  { key: 'status', title: '状态' },
]
const rows = [
  { id: 1, name: 'edge-fn-sh', region: '上海', status: '运行中' },
  { id: 2, name: 'api-sg', region: '新加坡', status: '运行中' },
  { id: 3, name: 'cron-fra', region: '法兰克福', status: '已停止' },
]
const target = ref()
const last = ref('无')
</script>

<template>
  <DouContextMenu
    v-model:target="target"
    :before-open="() => !!target"
    @select="(value) => (last = `${value}「${target.name}」`)"
  >
    <DouTable
      :data="rows"
      :columns="columns"
      row-key="id"
      @row-contextmenu="(row) => (target = row)"
    />
    <template #menu>
      <DouDropdownItem value="重启">重启</DouDropdownItem>
      <DouDropdownItem value="查看日志">查看日志</DouDropdownItem>
      <DouDropdownItem value="删除" tone="danger">删除</DouDropdownItem>
    </template>
  </DouContextMenu>
  <DouText variant="tertiary" size="sm">最近的操作：{{ last }}</DouText>
</template>
