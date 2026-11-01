<script setup>
import { DouChart, DouChartAxis, DouChartHeatmap } from '@dou-ui/chart'

// 一周里每两小时的访问量：工作日午后最多，周末上午偏少
const days = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
const hours = Array.from({ length: 12 }, (_, i) => `${i * 2}时`)
let seed = 11
const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
const visits = days.flatMap((day, d) =>
  hours.map((hour, h) => {
    const peak = Math.exp(-((h - 7) ** 2) / 8) + 0.5 * Math.exp(-((h - 10) ** 2) / 3)
    const weekend = d >= 5 ? 0.6 : 1
    return { day, hour, visits: Math.round((40 + 900 * peak * weekend) * (0.85 + random() * 0.3)) }
  }),
)
</script>

<template>
  <DouChart :data="visits" x="hour" :height="300">
    <DouChartAxis for="y" title="星期" />
    <DouChartHeatmap y="day" value="visits" name="访问量" />
  </DouChart>
</template>
