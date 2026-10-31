<script setup>
import { DouButton, DouSpace } from 'dou-ui'
import { DouChart, DouChartAxis, DouChartLine } from '@dou-ui/chart'
import { onBeforeUnmount, onMounted, shallowRef } from 'vue'

// 只保留最近的 1 万个读数
const WINDOW = 10_000
// 从整秒开始，每个读数相隔 100 毫秒
const start = Math.floor(Date.now() / 1000) * 1000 - WINDOW * 100
let value = 20
const reading = (time) => {
  value += (Math.random() - 0.5) * 0.6 + (20 - value) * 0.01
  return { time, value }
}
const rows = shallowRef(Array.from({ length: WINDOW }, (_, i) => reading(start + i * 100)))

// 每 100 毫秒来一个读数：换成新数组，去掉最早的一个，在末尾加上新的
function tick() {
  const last = rows.value[rows.value.length - 1]
  const next = rows.value.slice(1)
  next.push(reading(last.time + 100))
  rows.value = next
}

const running = shallowRef(true)
let timer = 0
const play = () => {
  running.value = true
  timer = setInterval(tick, 100)
}
const pause = () => {
  running.value = false
  clearInterval(timer)
}
onMounted(play)
onBeforeUnmount(pause)
</script>

<template>
  <div class="live">
    <DouSpace>
      <DouButton size="sm" @click="running ? pause() : play()">
        {{ running ? '暂停' : '继续' }}
      </DouButton>
    </DouSpace>
    <DouChart :data="rows" x="time" :height="240">
      <DouChartAxis for="x" type="time" />
      <DouChartLine y="value" name="上海机房温度（℃）" :line-width="1.5" />
    </DouChart>
  </div>
</template>

<style scoped>
.live {
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: 12px;
}
</style>
