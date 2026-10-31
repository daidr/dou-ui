<script setup>
import { DouChart, DouChartAxis, DouChartScatter } from '@dou-ui/chart'

// 各城市门店：开业年数、坪效（元/㎡）和门店数量
const rows = [
  { city: '上海', years: 9, yield: 4200, stores: 46 },
  { city: '北京', years: 8, yield: 3900, stores: 38 },
  { city: '杭州', years: 6, yield: 3300, stores: 21 },
  { city: '南京', years: 5, yield: 2900, stores: 14 },
  { city: '苏州', years: 4, yield: 3100, stores: 12 },
  { city: '成都', years: 3, yield: 2600, stores: 17 },
  { city: '武汉', years: 2, yield: 2200, stores: 9 },
  { city: '西安', years: 1, yield: 1800, stores: 5 },
]
</script>

<template>
  <DouChart :data="rows" x="years" :height="300">
    <DouChartAxis for="x" title="开业年数" />
    <DouChartAxis for="y" title="坪效（元/㎡）" />
    <DouChartScatter y="yield" size="stores" name="门店数量" />
  </DouChart>
</template>
