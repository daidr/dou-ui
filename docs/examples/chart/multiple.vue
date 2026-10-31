<script setup>
import { DouChart, DouChartAxis, DouChartLine } from '@dou-ui/chart'

// 三家门店近八周的日客流
const days = 56
const start = new Date(2026, 8, 7)
const wave = (i, base, swing) =>
  Math.round(base + swing * Math.sin(i / 3.2) + (i % 7 >= 5 ? swing * 1.4 : 0) + i * 2)

const rows = Array.from({ length: days }, (_, i) => ({
  date: new Date(start.getFullYear(), start.getMonth(), start.getDate() + i),
  sh: wave(i, 620, 70),
  bj: wave(i + 2, 480, 60),
  hz: wave(i + 4, 360, 50),
}))
</script>

<template>
  <DouChart :data="rows" x="date" :height="300">
    <DouChartAxis position="left" title="客流（人次）" />
    <DouChartLine y="sh" name="上海店" smooth />
    <DouChartLine y="bj" name="北京店" smooth />
    <DouChartLine y="hz" name="杭州店" smooth />
  </DouChart>
</template>
