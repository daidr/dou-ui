<script setup>
import { DouChart, DouChartPie } from '@dou-ui/chart'

// 戴兜本周的时间分配（小时）
const rows = [
  { item: '写代码', hours: 22 },
  { item: '开会', hours: 7 },
  { item: '评审', hours: 5 },
  { item: '写文档', hours: 4 },
]
const total = rows.reduce((sum, row) => sum + row.hours, 0)
</script>

<template>
  <DouChart :data="rows" x="item" :height="280">
    <DouChartPie value="hours" name="本周时间" :inner-radius="0.62">
      <div class="donut-total">{{ total }}</div>
      <div class="donut-label">小时</div>
    </DouChartPie>
  </DouChart>
</template>

<style scoped>
.donut-total {
  font-size: 24px;
  font-weight: 600;
  line-height: 32px;
}

.donut-label {
  color: var(--dou-color-text-tertiary);
  font-size: 12px;
}
</style>
