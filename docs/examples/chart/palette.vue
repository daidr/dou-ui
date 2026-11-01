<script setup>
import { DouChart, DouChartAxis, DouChartLine } from '@dou-ui/chart'

// 三个渠道近半年的订单量：品牌色在前，其余用语气色；
// light-dark() 分别给浅色和深色主题一个颜色，切换主题时图表自动重绘
const months = ['5月', '6月', '7月', '8月', '9月', '10月']
const rows = months.map((month, i) => ({
  month,
  app: 320 + i * 40 + (i % 2) * 30,
  web: 260 + i * 18,
  shop: 180 + ((i * 37) % 60),
}))

const palette = ['light-dark(#2f6f73, #6fb3ae)', 'light-dark(#a8744a, #d3a47c)', 'neutral']
</script>

<template>
  <DouChart :data="rows" x="month" :height="280" :palette="palette">
    <DouChartAxis for="y" title="订单量" />
    <DouChartLine y="app" name="小程序" />
    <DouChartLine y="web" name="网页" />
    <DouChartLine y="shop" name="门店" dashed />
  </DouChart>
</template>
