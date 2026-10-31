<script setup>
import { computed, ref } from 'vue'
import { DouChart, DouChartAxis, DouChartBrush, DouChartScatter } from '@dou-ui/chart'

// 60 家门店的面积和月销售额：面积越大，销售额大体越高
let seed = 7
const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
const rows = Array.from({ length: 60 }, (_, i) => {
  const area = Math.round(60 + random() * 240)
  const sales = Math.round(area * 0.36 + (random() - 0.5) * 40)
  return { name: `门店 ${i + 1}`, area, sales }
})

const picked = ref([])
function onSelect(event) {
  picked.value = event.rows
}
const summary = computed(() => {
  const list = picked.value
  if (!list.length) return '拖动选出一片门店，按 Esc 或点击选区外面清除'
  const average = list.reduce((sum, row) => sum + row.sales, 0) / list.length
  return `选中 ${list.length} 家门店，平均月销售额 ${average.toFixed(1)} 万元`
})
</script>

<template>
  <div class="brush">
    <DouChart :data="rows" x="area" :height="300">
      <DouChartAxis for="x" title="面积（㎡）" />
      <DouChartAxis for="y" title="月销售额（万元）" />
      <DouChartScatter y="sales" name="门店" label="name" />
      <DouChartBrush axis="xy" @select="onSelect" />
    </DouChart>
    <p class="note">{{ summary }}</p>
  </div>
</template>

<style scoped>
.brush {
  width: 100%;
}
.note {
  margin: 8px 0 0;
  color: var(--dou-color-text-tertiary);
  font-size: var(--dou-font-size-sm);
}
</style>
