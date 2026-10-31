<script setup>
import { DouChart, DouChartLine } from '@dou-ui/chart'

// 传感器在 6 日和 11–12 日没有上报
const rows = [
  21.4,
  22.1,
  21.8,
  23.0,
  22.6,
  null,
  23.4,
  24.1,
  23.7,
  24.5,
  null,
  null,
  25.2,
  24.8,
].map((value, i) => ({ date: `2026-10-${String(i + 1).padStart(2, '0')}`, value }))
</script>

<template>
  <DouChart :data="rows" x="date" :height="240">
    <DouChartLine y="value" name="温度（℃）" />
  </DouChart>
</template>
