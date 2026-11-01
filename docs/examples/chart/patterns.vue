<script setup>
import { DouChart, DouChartBar, DouChartTooltip } from '@dou-ui/chart'

// 上海三家门店各季度的营业额（万元）
const rows = [
  { quarter: '一季度', xuhui: 320, jingan: 410, pudong: 280 },
  { quarter: '二季度', xuhui: 360, jingan: 390, pudong: 340 },
  { quarter: '三季度', xuhui: 410, jingan: 450, pudong: 380 },
  { quarter: '四季度', xuhui: 450, jingan: 520, pudong: 430 },
]
</script>

<template>
  <DouChart :data="rows" x="quarter" :height="280" patterns>
    <DouChartBar y="xuhui" name="徐汇店" />
    <DouChartBar y="jingan" name="静安店" />
    <DouChartBar y="pudong" name="浦东店" />
    <DouChartTooltip />
  </DouChart>
</template>
