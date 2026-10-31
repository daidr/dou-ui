<script setup>
import { ref } from 'vue'
import { DouChart, DouChartAxis, DouChartLine } from '@dou-ui/chart'

// 三家门店近八周的日客流
const days = 56
const start = new Date(2026, 8, 7)
const wave = (i, base, swing) =>
  Math.round(base + swing * Math.sin(i / 3.2) + (i % 7 >= 5 ? swing * 1.4 : 0) + i * 2)

const rows = Array.from({ length: days }, (_, i) => ({
  date: new Date(start.getFullYear(), start.getMonth(), start.getDate() + i),
  sh: wave(i, 620, 70),
  bj: wave(i + 2, 480, 60),
  hz: wave(i + 4, 360, 50),
}))

// 杭州店先不显示，点击图例可以打开
const hideHz = ref(true)
</script>

<template>
  <DouChart :data="rows" x="date" :height="300">
    <DouChartAxis for="y" title="客流（人次）" />
    <DouChartLine y="sh" name="上海店" />
    <DouChartLine y="bj" name="北京店" />
    <DouChartLine v-model:hidden="hideHz" y="hz" name="杭州店" />
  </DouChart>
</template>
