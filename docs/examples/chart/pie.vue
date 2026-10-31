<script setup>
import { DouChart, DouChartPie } from '@dou-ui/chart'

// 一个月的支出构成（元）
const rows = [
  { item: '房租', amount: 4200 },
  { item: '餐饮', amount: 2350 },
  { item: '交通', amount: 680 },
  { item: '购物', amount: 1460 },
  { item: '其他', amount: 520 },
]
</script>

<template>
  <DouChart :data="rows" x="item" :height="280">
    <DouChartPie value="amount" name="月支出" />
  </DouChart>
</template>
