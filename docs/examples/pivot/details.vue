<script setup>
import { DouPivot } from '@dou-ui/pivot'
import { ref } from 'vue'
import { fields, orders } from './orders'

const config = ref({ rows: ['region'], columns: ['channel'], values: ['amount'] })
const picked = ref(null)

function onCellClick(cell) {
  // records() 给出这一格汇总了哪些记录（在 data 里的下标）
  const list = cell.records().map((i) => orders[i])
  const where = [...cell.row, ...cell.column].join(' · ') || '全部'
  const biggest = list.reduce((a, b) => (b.amount > a.amount ? b : a), list[0])
  picked.value = biggest
    ? `${where}：${list.length} 笔订单，最大一笔是 ${biggest.city}的${biggest.category} ${biggest.amount} 元`
    : `${where}：没有订单`
}
</script>

<template>
  <div class="pivot-demo">
    <DouPivot
      v-model:config="config"
      :data="orders"
      :fields="fields"
      :height="260"
      @cell-click="onCellClick"
    />
    <p class="picked">{{ picked ?? '点击一个数字查看明细' }}</p>
  </div>
</template>

<style scoped>
.pivot-demo {
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: 12px;
}
.picked {
  margin: 0;
  color: var(--dou-color-text-secondary);
  font-size: var(--dou-font-size-sm);
}
</style>
