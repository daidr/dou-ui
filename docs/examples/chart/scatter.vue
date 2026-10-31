<script setup>
import { DouChart, DouChartAxis, DouChartScatter } from '@dou-ui/chart'

// 两类商品的价格和月销量：价格越高，销量越低
let seed = 7
const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
const goods = (count, base, slope) =>
  Array.from({ length: count }, () => {
    const price = 20 + random() * 180
    return { price: Math.round(price), sales: Math.round(base - slope * price + random() * 260) }
  })
const daily = goods(60, 1200, 4.2)
const gifts = goods(40, 760, 2.4)
</script>

<template>
  <DouChart x="price" :height="300">
    <DouChartAxis for="x" title="价格（元）" />
    <DouChartAxis for="y" title="月销量" />
    <DouChartScatter :data="daily" y="sales" name="日用品" />
    <DouChartScatter :data="gifts" y="sales" name="礼品" />
  </DouChart>
</template>
