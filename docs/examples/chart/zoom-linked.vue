<script setup>
import { ref } from 'vue'
import { DouChart, DouChartAxis, DouChartBar, DouChartLine, DouChartZoom } from '@dou-ui/chart'

// 上海店近 90 天的客流和客单价
const start = new Date(2026, 7, 3)
const rows = Array.from({ length: 90 }, (_, i) => ({
  date: new Date(start.getFullYear(), start.getMonth(), start.getDate() + i),
  visits: Math.round(620 + 80 * Math.sin(i / 6) + (i % 7 >= 5 ? 160 : 0)),
  price: Math.round(86 + 6 * Math.sin(i / 9 + 1) - (i % 7 >= 5 ? 4 : 0)),
}))

// 两个图表绑定同一个值，缩放和平移一起变化
const range = ref(null)
</script>

<template>
  <div class="linked">
    <DouChart :data="rows" x="date" :height="200">
      <DouChartAxis for="y" title="客流（人次）" />
      <DouChartBar y="visits" name="客流" />
      <DouChartZoom v-model:x="range" />
    </DouChart>
    <DouChart :data="rows" x="date" :height="200">
      <DouChartAxis for="y" title="客单价（元）" />
      <DouChartLine y="price" name="客单价" />
      <DouChartZoom v-model:x="range" />
    </DouChart>
  </div>
</template>

<style scoped>
.linked {
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: 16px;
}
</style>
