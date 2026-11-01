<script setup>
import { DouChart, DouChartPie } from '@dou-ui/chart'

// 上个月上海门店的订单来源
const rows = [
  { channel: '门店', orders: 4620 },
  { channel: '小程序', orders: 2810 },
  { channel: '外卖平台', orders: 1930 },
  { channel: '团购', orders: 690 },
  { channel: '企业订餐', orders: 240 },
]
</script>

<template>
  <DouChart :data="rows" x="channel" :height="280" :legend="false">
    <DouChartPie value="orders" name="订单来源" :inner-radius="0.6" labels />
  </DouChart>
</template>
