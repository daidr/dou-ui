<script setup>
import { DouChart, DouChartLine } from '@dou-ui/chart'

const visits = [
  { month: '1月', users: 3820 },
  { month: '2月', users: 3410 },
  { month: '3月', users: 4260 },
  { month: '4月', users: 4790 },
  { month: '5月', users: 5130 },
  { month: '6月', users: 4880 },
  { month: '7月', users: 5620 },
  { month: '8月', users: 6050 },
  { month: '9月', users: 5870 },
  { month: '10月', users: 6420 },
  { month: '11月', users: 6910 },
  { month: '12月', users: 7380 },
]
</script>

<template>
  <DouChart :data="visits" x="month" :height="280">
    <DouChartLine y="users" name="月活跃用户" />
  </DouChart>
</template>
