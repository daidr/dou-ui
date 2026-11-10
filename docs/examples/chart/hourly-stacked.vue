<script setup>
import { DouChart, DouChartAxis, DouChartBar, DouChartRange, DouChartZoom } from '@dou-ui/chart'
import { shallowRef } from 'vue'

// 上海一家网店一年里每小时的订单，按渠道堆叠：8760 个小时，每个小时 3 根柱子
const channels = [
  { key: 'app', name: 'App' },
  { key: 'web', name: '网页' },
  { key: 'mini', name: '小程序' },
]

function generate() {
  let seed = 8760
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  const start = new Date(2025, 10, 11).getTime()
  const hours = 365 * 24
  const time = new Float64Array(hours)
  const columns = {
    app: new Float64Array(hours),
    web: new Float64Array(hours),
    mini: new Float64Array(hours),
  }
  for (let i = 0; i < hours; i++) {
    const hour = i % 24
    // 白天和晚上各有一个高峰，凌晨最少
    const daily = Math.max(
      0.05,
      Math.sin(((hour - 7) / 24) * Math.PI * 2) * 0.6 + (hour >= 19 && hour <= 22 ? 0.7 : 0.3),
    )
    const season = 1 + 0.25 * Math.sin((i / hours) * Math.PI * 2)
    time[i] = start + i * 3600_000
    columns.app[i] = Math.round(120 * daily * season * (0.8 + random() * 0.4))
    columns.web[i] = Math.round(50 * daily * season * (0.8 + random() * 0.4))
    columns.mini[i] = Math.round(70 * daily * season * (0.8 + random() * 0.4))
  }
  return { time, ...columns }
}

// 按列给数据：每列一个 Float64Array
const data = shallowRef(generate())
// 先显示最后两周，拖动下面的缩略图或按住 Ctrl 滚动来看其他时间
const last = data.value.time[data.value.time.length - 1]
const range = shallowRef([new Date(last - 14 * 24 * 3600_000), new Date(last)])
</script>

<template>
  <DouChart :data="data" x="time" :height="300">
    <!-- 时间是毫秒数，用 type 把横轴指定为时间轴 -->
    <DouChartAxis for="x" type="time" />
    <DouChartBar
      v-for="channel in channels"
      :key="channel.key"
      :y="channel.key"
      :name="channel.name"
      stack
    />
    <DouChartZoom v-model:x="range" />
    <DouChartRange />
  </DouChart>
</template>
