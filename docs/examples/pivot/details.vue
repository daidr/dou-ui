<script setup>
import { DouButton, DouTable } from 'dou-ui'
import { DouPivot } from '@dou-ui/pivot'
import { computed, ref, shallowRef } from 'vue'
import { fields, orders } from './orders'

const config = ref({ rows: ['region'], columns: ['channel'], values: ['amount'] })
const cell = shallowRef(null)

const columns = [
  { key: 'date', title: '日期', width: 72 },
  { key: 'city', title: '城市', width: 64 },
  { key: 'category', title: '品类', width: 64 },
  { key: 'cups', title: '杯数', align: 'end', width: 56 },
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
// 标出被点击的格子所在的行和列
const highlight = computed(() =>
  cell.value ? { row: cell.value.row, column: cell.value.column } : undefined,
)
const title = computed(() => {
  if (!cell.value) return '点击一个数字查看明细'
  const where = [...cell.value.labels.row, ...cell.value.labels.column].join(' · ')
  return `${where || '全部订单'}（${records.value.length} 笔）`
})
</script>

<template>
  <div class="details">
    <DouPivot
      v-model:config="config"
      :data="orders"
      :fields="fields"
      :max-height="220"
      :highlight="highlight"
      @cell-click="cell = $event"
    />
    <section class="details__list" aria-live="polite">
      <div class="details__head">
        <span>{{ title }}</span>
        <DouButton v-if="cell" variant="ghost" size="sm" @click="cell = null">清除</DouButton>
      </div>
      <DouTable
        v-if="cell"
        :data="records"
        :columns="columns"
        row-key="id"
        virtual
        :row-height="32"
        size="sm"
        :max-height="240"
      />
    </section>
  </div>
</template>

<style scoped>
.details {
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: var(--dou-space-md);
}

.details__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 28px;
  margin-bottom: var(--dou-space-sm);
  font-size: var(--dou-font-size-sm);
  color: var(--dou-color-text-secondary);
}
</style>
