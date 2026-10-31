<script setup>
import { DouChart, DouChartBar } from '@dou-ui/chart'

// 一年里每个月的净利润（万元），有盈有亏
const profit = [42, 18, -12, 26, 55, 61, 33, -24, -8, 37, 72, 90]
const rows = profit.map((value, i) => ({ month: `${i + 1}月`, value }))
</script>

<template>
  <DouChart :data="rows" x="month" :height="280">
    <DouChartBar y="value" name="净利润" />
  </DouChart>
</template>
