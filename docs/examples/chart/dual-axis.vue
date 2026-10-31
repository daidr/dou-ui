<script setup>
import { DouChart, DouChartAxis, DouChartLine } from '@dou-ui/chart'

const rows = [
  { week: '第 1 周', orders: 1240, rate: 0.031 },
  { week: '第 2 周', orders: 1385, rate: 0.034 },
  { week: '第 3 周', orders: 1310, rate: 0.029 },
  { week: '第 4 周', orders: 1620, rate: 0.038 },
  { week: '第 5 周', orders: 1790, rate: 0.041 },
  { week: '第 6 周', orders: 1705, rate: 0.036 },
  { week: '第 7 周', orders: 1960, rate: 0.044 },
  { week: '第 8 周', orders: 2140, rate: 0.047 },
]

const percent = (value) => `${(value * 100).toFixed(1)}%`
</script>

<template>
  <DouChart :data="rows" x="week" :height="300">
    <DouChartAxis for="y" title="订单数" />
    <DouChartAxis for="y2" title="转化率" :format="percent" />
    <DouChartLine y="orders" name="订单数" />
    <DouChartLine y="rate" name="转化率" axis="y2" dashed />
  </DouChart>
</template>
