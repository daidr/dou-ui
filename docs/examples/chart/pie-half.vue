<script setup>
import { DouChart, DouChartPie } from '@dou-ui/chart'

// 上海一家门店本月的预算执行（万元）
const rows = [
  { part: '已花费', amount: 38 },
  { part: '已预订', amount: 14 },
  { part: '剩余', amount: 28, color: 'neutral' },
]
</script>

<template>
  <DouChart :data="rows" x="part" :height="240">
    <DouChartPie
      value="amount"
      color="color"
      name="本月预算"
      :inner-radius="0.62"
      :start-angle="-90"
      :end-angle="90"
    >
      <div class="half-total">80</div>
      <div class="half-label">万元预算</div>
    </DouChartPie>
  </DouChart>
</template>

<style scoped>
.half-total {
  font-size: 24px;
  font-weight: 600;
  line-height: 32px;
}

.half-label {
  color: var(--dou-color-text-tertiary);
  font-size: 12px;
}
</style>
