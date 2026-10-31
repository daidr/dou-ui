<script setup>
import { DouChart, DouChartArea, DouChartMarker } from '@dou-ui/chart'

// 一天里每小时的在线人数
const hours = Array.from({ length: 24 }, (_, h) => ({
  hour: `${h}时`,
  online: Math.round(
    1200 + 2600 * Math.exp(-((h - 20) ** 2) / 18) + 900 * Math.exp(-((h - 12) ** 2) / 6),
  ),
}))
const peak = hours.reduce((a, b) => (b.online > a.online ? b : a))
</script>

<template>
  <DouChart :data="hours" x="hour" :height="280">
    <DouChartArea y="online" name="在线人数" />
    <!-- x 和 y 都是单个值时，标出一个点 -->
    <DouChartMarker :x="peak.hour" :y="peak.online" :label="`峰值 ${peak.online}`" tone="primary" />
  </DouChart>
</template>
