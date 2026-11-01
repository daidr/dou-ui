<script setup>
import { DouChart, DouChartAxis, DouChartBar } from '@dou-ui/chart'

// 上海门店每个季度的订单，按渠道
const rows = [
  { quarter: '一季度', store: 4600, app: 2100, delivery: 1700 },
  { quarter: '二季度', store: 4900, app: 2800, delivery: 2300 },
  { quarter: '三季度', store: 5200, app: 3600, delivery: 3100 },
  { quarter: '四季度', store: 4800, app: 4100, delivery: 3300 },
]
</script>

<template>
  <DouChart :data="rows" x="quarter" :height="300">
    <DouChartAxis for="y" percent />
    <DouChartBar y="store" name="门店" stack labels />
    <DouChartBar y="app" name="小程序" stack labels />
    <DouChartBar y="delivery" name="外卖" stack labels />
  </DouChart>
</template>
