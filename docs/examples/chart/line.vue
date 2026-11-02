<script setup>
import { DouChart, DouChartLine } from '@dou-ui/chart'

// 上海一周的最高气温：实测和预报
const rows = [
  { day: '周一', actual: 21, forecast: 22 },
  { day: '周二', actual: 23, forecast: 22 },
  { day: '周三', actual: 19, forecast: 20 },
  { day: '周四', actual: 18, forecast: 18 },
  { day: '周五', actual: 22, forecast: 21 },
  { day: '周六', actual: 25, forecast: 24 },
  { day: '周日', actual: 24, forecast: 25 },
]
</script>

<template>
  <DouChart :data="rows" x="day" :height="260">
    <DouChartLine y="actual" name="实测" smooth />
    <DouChartLine y="forecast" name="预报" dashed :dots="false" />
  </DouChart>
</template>
