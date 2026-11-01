<script setup>
import { DouChart, DouChartFunnel } from '@dou-ui/chart'

// 一次线上活动从浏览到付款的人数
const steps = [
  { step: '浏览活动页', users: 12800 },
  { step: '领取优惠券', users: 6420 },
  { step: '加入购物车', users: 3980 },
  { step: '提交订单', users: 2150 },
  { step: '完成付款', users: 1730 },
]
</script>

<template>
  <DouChart :data="steps" x="step" :height="280">
    <DouChartFunnel y="users" name="人数" />
  </DouChart>
</template>
