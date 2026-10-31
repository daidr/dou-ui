<script setup>
import { DouChart, DouChartAxis, DouChartBar, DouChartLine } from '@dou-ui/chart'

// 每月的订单数和平均配送时长
const rows = [
  { month: '1月', orders: 3200, minutes: 38 },
  { month: '2月', orders: 2800, minutes: 41 },
  { month: '3月', orders: 3650, minutes: 36 },
  { month: '4月', orders: 3900, minutes: 34 },
  { month: '5月', orders: 4300, minutes: 33 },
  { month: '6月', orders: 4800, minutes: 35 },
  { month: '7月', orders: 5200, minutes: 39 },
  { month: '8月', orders: 5050, minutes: 37 },
]
</script>

<template>
  <DouChart :data="rows" x="month" :height="300">
    <DouChartAxis for="y" title="订单数" />
    <DouChartAxis for="y2" title="配送时长（分钟）" />
    <DouChartBar y="orders" name="订单数" />
    <DouChartLine y="minutes" name="平均配送时长" axis="y2" />
  </DouChart>
</template>
