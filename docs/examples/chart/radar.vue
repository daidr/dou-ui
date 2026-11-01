<script setup>
import { DouChart, DouChartRadar } from '@dou-ui/chart'

// 两款手机在六个方面的评分，满分 100
const scores = [
  { item: '性能', a: 92, b: 78 },
  { item: '续航', a: 70, b: 88 },
  { item: '拍照', a: 86, b: 74 },
  { item: '屏幕', a: 90, b: 82 },
  { item: '重量', a: 64, b: 90 },
  { item: '价格', a: 58, b: 84 },
]
</script>

<template>
  <DouChart :data="scores" x="item" :height="320">
    <DouChartRadar y="a" name="旗舰款" />
    <DouChartRadar y="b" name="轻薄款" />
  </DouChart>
</template>
