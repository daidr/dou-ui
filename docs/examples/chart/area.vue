<script setup>
import { DouChart, DouChartArea } from '@dou-ui/chart'

// 一天里每小时的访问来源
const rows = Array.from({ length: 24 }, (_, hour) => {
  const day = Math.max(0, Math.sin(((hour - 6) / 24) * Math.PI * 2)) + 0.15
  return {
    hour: `2026-10-30 ${String(hour).padStart(2, '0')}:00`,
    direct: Math.round(320 * day + 40),
    search: Math.round(260 * day + 30),
    social: Math.round(180 * day * (hour > 18 ? 1.6 : 1) + 20),
  }
})
</script>

<template>
  <DouChart :data="rows" x="hour" :height="300">
    <DouChartArea y="direct" name="直接访问" stack />
    <DouChartArea y="search" name="搜索" stack />
    <DouChartArea y="social" name="社交媒体" stack />
  </DouChart>
</template>
