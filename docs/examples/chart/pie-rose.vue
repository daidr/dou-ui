<script setup>
import { DouChart, DouChartPie } from '@dou-ui/chart'

// 一家咖啡店一周各天的订单数
const rows = [
  { day: '周一', orders: 186 },
  { day: '周二', orders: 204 },
  { day: '周三', orders: 231 },
  { day: '周四', orders: 248 },
  { day: '周五', orders: 312 },
  { day: '周六', orders: 405 },
  { day: '周日', orders: 368 },
]
</script>

<template>
  <DouChart :data="rows" x="day" :height="300">
    <DouChartPie value="orders" name="每日订单" rose :inner-radius="0.2" />
  </DouChart>
</template>
