<script setup>
import { DouChart, DouChartGauge } from '@dou-ui/chart'

// 上海一家门店本月的两个指标
const done = 86
const returns = 6.2
// 完成率达到 80% 显示成功色，否则显示警告色
const doneColor = (value) => (value >= 80 ? 'success' : 'warning')
const percent = (value) => `${value}%`
</script>

<template>
  <div class="gauges">
    <DouChart :height="200">
      <DouChartGauge :value="done" name="目标完成率" :color="doneColor" :format="percent" />
    </DouChart>
    <DouChart :height="200">
      <DouChartGauge
        :value="returns"
        :max="20"
        name="退货率"
        color="danger"
        :format="percent"
        :start-angle="-90"
        :end-angle="90"
      />
    </DouChart>
  </div>
</template>

<style scoped>
.gauges {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  width: 100%;
}

.gauges > * {
  flex: 1 1 220px;
  min-width: 0;
}
</style>
