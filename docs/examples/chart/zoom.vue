<script setup>
import { computed, ref } from 'vue'
import { DouChart, DouChartArea, DouChartRange, DouChartZoom } from '@dou-ui/chart'

// 上海店一年的日销售额
const start = new Date(2025, 10, 1)
const rows = Array.from({ length: 365 }, (_, i) => ({
  date: new Date(start.getFullYear(), start.getMonth(), start.getDate() + i),
  sales: Math.round(
    42 + 10 * Math.sin(i / 58) + (i % 7 >= 5 ? 9 : 0) + 4 * Math.sin(i * 1.7) + i * 0.04,
  ),
}))

// 显示的时间段，null 表示全部
const range = ref(null)
const day = (d) => `${d.getMonth() + 1} 月 ${d.getDate()} 日`
const text = computed(() =>
  range.value ? `${day(range.value[0])} 至 ${day(range.value[1])}` : '全部',
)
</script>

<template>
  <div class="zoom">
    <DouChart :data="rows" x="date" :height="320">
      <DouChartArea y="sales" name="销售额（万元）" />
      <DouChartZoom v-model:x="range" />
      <DouChartRange />
    </DouChart>
    <p class="note">当前显示：{{ text }}</p>
  </div>
</template>

<style scoped>
.zoom {
  width: 100%;
}
.note {
  margin: 8px 0 0;
  color: var(--dou-color-text-tertiary);
  font-size: var(--dou-font-size-sm);
}
</style>
