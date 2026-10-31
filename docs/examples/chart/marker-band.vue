<script setup>
import { DouChart, DouChartAxis, DouChartLine, DouChartMarker } from '@dou-ui/chart'

// 十月每天的平均响应时间（毫秒）
const days = Array.from({ length: 31 }, (_, i) => ({
  day: `2026-10-${String(i + 1).padStart(2, '0')}`,
  ms: Math.round(180 + 40 * Math.sin(i / 3) + (i >= 1 && i <= 6 ? 90 : 0) + ((i * 37) % 23)),
}))
const ms = (value) => `${value}ms`
</script>

<template>
  <DouChart :data="days" x="day" :height="280">
    <DouChartAxis for="y" :format="ms" />
    <DouChartLine y="ms" name="响应时间" />
    <!-- 给出两端，就是一段区间 -->
    <DouChartMarker :x="['2026-10-02', '2026-10-07']" label="假期高峰" tone="warning" />
    <DouChartMarker :y="[150, 250]" label="正常范围" />
  </DouChart>
</template>
