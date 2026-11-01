<script setup>
import { DouChart, DouChartAxis, DouChartLine } from '@dou-ui/chart'

// 三家门店今年每月的会员数（千人）
const months = Array.from({ length: 10 }, (_, i) => `${i + 1}月`)
const grow = (start, step, wobble) =>
  months.map((_, i) => Math.round((start + step * i + Math.sin(i * 1.3) * wobble) * 10) / 10)
const xuhui = grow(4.2, 0.46, 0.3)
const jingan = grow(3.6, 0.38, 0.4)
const pudong = grow(2.1, 0.52, 0.2)
const rows = months.map((month, i) => ({
  month,
  xuhui: xuhui[i],
  jingan: jingan[i],
  pudong: pudong[i],
}))
const thousand = (value) => `${value} 千人`
// 写系列的名称和最新的值
const named = ({ name, value }) => `${name} ${value}`
</script>

<template>
  <DouChart :data="rows" x="month" :height="280" :legend="false">
    <DouChartAxis for="y" :format="thousand" />
    <DouChartLine y="xuhui" name="徐汇店" :labels="named" label-position="end" />
    <DouChartLine y="jingan" name="静安店" :labels="named" label-position="end" />
    <DouChartLine y="pudong" name="浦东店" :labels="named" label-position="end" />
  </DouChart>
</template>
