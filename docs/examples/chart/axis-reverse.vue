<script setup>
import { DouChart, DouChartAxis, DouChartLine } from '@dou-ui/chart'

// 三家门店每月销售额的排名，第 1 名在最上面
const ranks = [
  { month: '1月', xuhui: 2, jingan: 1, pudong: 3 },
  { month: '2月', xuhui: 1, jingan: 2, pudong: 3 },
  { month: '3月', xuhui: 1, jingan: 3, pudong: 2 },
  { month: '4月', xuhui: 2, jingan: 3, pudong: 1 },
  { month: '5月', xuhui: 3, jingan: 2, pudong: 1 },
  { month: '6月', xuhui: 2, jingan: 1, pudong: 3 },
]
</script>

<template>
  <DouChart :data="ranks" x="month" :height="260">
    <DouChartAxis for="y" title="排名" reverse :min="1" :max="3" :ticks="[1, 2, 3]" />
    <DouChartLine y="xuhui" name="徐汇店" dots />
    <DouChartLine y="jingan" name="静安店" dots />
    <DouChartLine y="pudong" name="浦东店" dots />
  </DouChart>
</template>
