<script setup>
import { ref } from 'vue'

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
const methodsTable = ref()
const methodsSelected = ref([])
</script>

<template>
  <DouSpace size="sm" wrap>
    <DouButton size="sm" @click="methodsTable.toggleRowSelection(3)"> 切换第 3 行的选中 </DouButton>
    <DouButton size="sm" @click="methodsTable.clearSelection()">清除选中</DouButton>
    <DouButton size="sm" @click="methodsTable.scrollToRow(4000)">滚到第 4000 行</DouButton>
  </DouSpace>
  <DouTable
    ref="methodsTable"
    v-model:selected="methodsSelected"
    :data="huge"
    :columns="hugeColumns"
    selectable
    virtual
    :max-height="240"
    size="sm"
  />
</template>
