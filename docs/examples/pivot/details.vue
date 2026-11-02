<script setup>
import { DouPivot } from '@dou-ui/pivot'
import { computed, ref, shallowRef } from 'vue'
import { fields, orders } from './orders'

const config = ref({ rows: ['region'], columns: ['channel'], values: ['amount'] })
const open = ref(false)
const cell = shallowRef(null)

const columns = [
  { key: 'date', title: '下单日期', width: 120 },
  { key: 'city', title: '城市', width: 80 },
  { key: 'category', title: '品类', width: 80 },
  { key: 'cups', title: '杯数', align: 'end', width: 72 },
  { key: 'amount', title: '金额', align: 'end' },
]
const money = new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' })
const day = new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric' })

// records() 给出这一格汇总了哪些记录
const records = computed(() =>
  (cell.value?.records() ?? []).map((order, i) => ({
    id: i,
    date: day.format(order.date),
    city: order.city,
    category: order.category,
    cups: order.cups,
    amount: money.format(order.amount),
  })),
)
// 抽屉打开时标出被点击的格子所在的行和列
const highlight = computed(() =>
  open.value && cell.value ? { row: cell.value.row, column: cell.value.column } : undefined,
)
const title = computed(() => {
  const where = cell.value
    ? [...cell.value.labels.row, ...cell.value.labels.column].join(' · ')
    : ''
  return `${where || '全部订单'}（${records.value.length} 笔）`
})

function onCellClick(next) {
  cell.value = next
  open.value = true
}
</script>

<template>
  <DouPivot
    v-model:config="config"
    :data="orders"
    :fields="fields"
    :max-height="260"
    :highlight="highlight"
    @cell-click="onCellClick"
  />
  <DouDrawer v-model:open="open" :title="title" :size="520">
    <DouTable :data="records" :columns="columns" row-key="id" virtual size="sm" max-height="100%" />
  </DouDrawer>
</template>
