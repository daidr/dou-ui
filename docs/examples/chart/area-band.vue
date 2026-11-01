<script setup>
import { DouChart, DouChartArea, DouChartAxis, DouChartLine } from '@dou-ui/chart'

// 上海 11 月上旬每天的最高、最低气温和平均气温
const rows = [
  { day: '11-01', low: 14, high: 21 },
  { day: '11-02', low: 15, high: 23 },
  { day: '11-03', low: 16, high: 22 },
  { day: '11-04', low: 13, high: 19 },
  { day: '11-05', low: 11, high: 17 },
  { day: '11-06', low: 10, high: 18 },
  { day: '11-07', low: 12, high: 20 },
  { day: '11-08', low: 13, high: 21 },
  { day: '11-09', low: 12, high: 18 },
  { day: '11-10', low: 9, high: 15 },
].map((row) => ({ ...row, mean: (row.low + row.high) / 2 }))
const degrees = (value) => `${value}°C`
</script>

<template>
  <DouChart :data="rows" x="day" :height="280">
    <DouChartAxis for="y" :format="degrees" />
    <DouChartArea y="high" y0="low" name="最低 ~ 最高" :line-width="0" />
    <DouChartLine y="mean" name="平均" smooth />
  </DouChart>
</template>
