<script setup>
import { DouButton, DouSpace } from 'dou-ui'
import { DouPivot } from '@dou-ui/pivot'
import { nextTick, ref, shallowRef } from 'vue'
import { fields, makeOrders } from './orders'

// 大数据放在 shallowRef 里：数组整体替换，不需要逐项响应
const rows = shallowRef(makeOrders(100_000))
const took = ref('')
const config = ref({
  rows: ['region', 'city', 'category'],
  columns: ['quarter', 'month'],
  values: ['amount', { field: 'cups', aggregate: 'sum' }],
})

async function load(count) {
  const data = makeOrders(count, count)
  const start = performance.now()
  rows.value = data
  await nextTick()
  took.value = `${count.toLocaleString()} 条订单，分组、汇总并渲染用时 ${Math.round(performance.now() - start)} ms`
}

load(100_000)
</script>

<template>
  <div class="pivot-demo">
    <DouSpace>
      <DouButton size="sm" @click="load(100_000)">10 万条</DouButton>
      <DouButton size="sm" @click="load(1_000_000)">100 万条</DouButton>
      <span class="took">{{ took }}</span>
    </DouSpace>
    <DouPivot v-model:config="config" :data="rows" :fields="fields" :height="440" />
  </div>
</template>

<style scoped>
.pivot-demo {
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: 12px;
}
.took {
  color: var(--dou-color-text-tertiary);
  font-size: var(--dou-font-size-sm);
}
</style>
