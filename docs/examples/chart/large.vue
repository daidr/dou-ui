<script setup>
import { DouSegmentedControl } from 'dou-ui'
import { DouChart, DouChartAxis, DouChartLine, DouChartRange, DouChartZoom } from '@dou-ui/chart'
import { onBeforeUnmount, onMounted, shallowRef, useTemplateRef, watch } from 'vue'

const count = shallowRef(1_000_000)
// 读数保留 1 位小数
const oneDecimal = (value) => value.toFixed(1)
// 按列给数据：每个字段一个 Float64Array，读取时直接复制，不必逐行读取
const data = shallowRef(null)

function generate(n) {
  const start = new Date(2026, 9, 1).getTime()
  const time = new Float64Array(n)
  const value = new Float64Array(n)
  let v = 50
  for (let i = 0; i < n; i++) {
    v += (Math.random() - 0.5) * 2 + (50 - v) * 0.001
    time[i] = start + i * 1000
    value[i] = v
  }
  data.value = { time, value }
}

// 滚到示例附近时才生成数据，打开页面时不必等它
const box = useTemplateRef('box')
let observer
onMounted(() => {
  observer = new IntersectionObserver(
    ([entry]) => {
      if (!entry?.isIntersecting) return
      observer.disconnect()
      generate(count.value)
    },
    { rootMargin: '400px 0px' },
  )
  observer.observe(box.value)
})
onBeforeUnmount(() => observer?.disconnect())
watch(count, (n) => data.value && generate(n))
</script>

<template>
  <div ref="box" class="large">
    <DouSegmentedControl
      v-model="count"
      :options="[
        { value: 100_000, label: '10 万点' },
        { value: 1_000_000, label: '100 万点' },
      ]"
      size="sm"
    />
    <DouChart :data="data ?? []" x="time" :height="280">
      <!-- 时间是毫秒数，用 type 把横轴指定为时间轴 -->
      <DouChartAxis for="x" type="time" />
      <DouChartAxis for="y" :format="oneDecimal" />
      <DouChartLine y="value" name="读数" :line-width="1.5" />
      <DouChartZoom />
      <DouChartRange />
    </DouChart>
  </div>
</template>

<style scoped>
.large {
  display: flex;
  width: 100%;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
}
.large > :deep(.dou-chart) {
  align-self: stretch;
}
</style>
