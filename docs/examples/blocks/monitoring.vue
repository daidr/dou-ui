<script setup>
import {
  DouChart,
  DouChartArea,
  DouChartAxis,
  DouChartLine,
  DouChartMarker,
  DouChartZoom,
} from '@dou-ui/chart'
import { PauseIcon, PlayIcon } from '@dou-ui/icons'
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'

// 示例数据：dou-api 在上海机房的运行指标，每秒一个读数，保留最近 5 分钟
const WINDOW = 300
/** 延迟的目标：P95 不超过 300ms */
const SLO = 300

let tickCount = 0
let rps = 1200
let cpu = 46
/** 模拟一次故障：每 2 分钟有 15 秒延迟升高、5xx 增多 */
const incident = (n) => n % 120 >= 90 && n % 120 < 105
function reading(time) {
  const n = tickCount++
  const bad = incident(n)
  rps += (Math.random() - 0.5) * 80 + (1200 - rps) * 0.05
  cpu += (Math.random() - 0.5) * 4 + ((bad ? 88 : 46) - cpu) * 0.15
  const p50 = 80 + Math.random() * 20 + (bad ? 90 : 0)
  const requests = Math.round(rps)
  const errors = Math.round(
    rps * (bad ? 0.08 + Math.random() * 0.02 : 0.002 + Math.random() * 0.002),
  )
  return {
    time,
    requests,
    errors,
    // 百分比，保留 1 位小数
    errorRate: Math.round((errors / requests) * 1000) / 10,
    p50: Math.round(p50),
    p95: Math.round(p50 * (2.1 + Math.random() * 0.4) + (bad ? 80 : 0)),
    cpu: Math.round(cpu * 10) / 10,
  }
}

// 读数和当前时间有关，在浏览器里再生成；服务端渲染的页面里先是加载状态
const rows = shallowRef([])
function fill() {
  const start = Math.floor(Date.now() / 1000) * 1000 - WINDOW * 1000
  rows.value = Array.from({ length: WINDOW }, (_, i) => reading(start + i * 1000))
}
function tick() {
  const next = rows.value.slice(1)
  next.push(reading(rows.value[rows.value.length - 1].time + 1000))
  rows.value = next
}

const running = ref(true)
let timer = 0
function play() {
  running.value = true
  // 回到实时：放大过的图表恢复显示全部
  range.value = null
  timer = setInterval(tick, 1000)
}
function pause() {
  running.value = false
  clearInterval(timer)
}
onMounted(() => {
  fill()
  play()
})
onBeforeUnmount(pause)

// 四张图表绑定同一个范围，缩放和平移一起变化；暂停后才能缩放
const range = ref(null)

const last = computed(() => rows.value[rows.value.length - 1])
const average = (key, from = 0) => {
  const list = rows.value.slice(from)
  return list.reduce((sum, row) => sum + row[key], 0) / (list.length || 1)
}
const cards = computed(() => {
  if (!last.value) return []
  const recent = rows.value.slice(-60)
  const errors = recent.reduce((sum, row) => sum + row.errors, 0)
  const requests = recent.reduce((sum, row) => sum + row.requests, 0)
  return [
    { title: '每秒请求', value: last.value.requests, precision: 0 },
    { title: 'P95 延迟', value: last.value.p95, suffix: 'ms', bad: last.value.p95 > SLO },
    {
      title: '近 1 分钟 5xx',
      value: (errors / requests) * 100,
      precision: 2,
      suffix: '%',
      bad: errors / requests > 0.01,
    },
    {
      title: 'CPU',
      value: average('cpu', -10),
      precision: 0,
      suffix: '%',
      bad: last.value.cpu > 80,
    },
  ]
})

// 延迟超过目标的时段，标成区间
const breaches = computed(() => {
  const list = []
  let from = null
  rows.value.forEach((row, i) => {
    const over = row.p95 > SLO
    if (over && from === null) from = row.time
    const end = !over || i === rows.value.length - 1
    if (from !== null && end) {
      list.push([from, over ? row.time : rows.value[i - 1].time])
      from = null
    }
  })
  return list
})

const clock = (time) => {
  const date = new Date(time)
  return [date.getHours(), date.getMinutes(), date.getSeconds()]
    .map((n) => String(n).padStart(2, '0'))
    .join(':')
}
// 最近的在最前面
const events = computed(() => {
  const list = []
  for (let i = breaches.value.length - 1; i >= 0; i--) {
    const [from, to] = breaches.value[i]
    list.push({ key: from, time: clock(from), seconds: Math.round((to - from) / 1000) + 1 })
  }
  return list
})

const perSecond = (value) => `${value}/s`
const ms = (value) => `${value}ms`
const pct = (value) => `${value}%`
</script>

<template>
  <div class="monitor">
    <DouPageHeader title="dou-api" subtitle="上海机房 · 最近 5 分钟" :show-back="false" :level="2">
      <template #extra>
        <DouTag :tone="running ? 'success' : 'neutral'" size="sm">
          {{ running ? '实时' : '已暂停' }}
        </DouTag>
        <DouButton size="sm" variant="outline" @click="running ? pause() : play()">
          <template #leading><PauseIcon v-if="running" /><PlayIcon v-else /></template>
          {{ running ? '暂停' : '回到实时' }}
        </DouButton>
      </template>
    </DouPageHeader>

    <div class="monitor__cards">
      <DouCard v-for="card in cards" :key="card.title" padding="md">
        <DouStatistic
          :title="card.title"
          :value="card.value"
          :precision="card.precision"
          :suffix="card.suffix"
          :class="{ 'is-bad': card.bad }"
        />
      </DouCard>
    </div>

    <div class="monitor__body">
      <DouCard
        title="指标"
        :description="
          running ? '暂停后可以缩放、平移，四张图表一起变化' : '按住 Ctrl 或 ⌘ 滚动缩放，拖动平移'
        "
        class="monitor__charts"
      >
        <section>
          <DouText as="h3" weight="bold">每秒请求</DouText>
          <DouChart :data="rows" x="time" :height="140" :loading="!rows.length">
            <DouChartAxis for="x" type="time" />
            <DouChartAxis for="y" :format="perSecond" :label-width="48" :ticks="3" />
            <DouChartArea y="requests" name="每秒请求" />
            <DouChartZoom v-model:x="range" :disabled="running" />
          </DouChart>
        </section>
        <section>
          <DouText as="h3" weight="bold">5xx 错误率</DouText>
          <DouChart :data="rows" x="time" :height="140" :loading="!rows.length">
            <DouChartAxis for="x" type="time" />
            <DouChartAxis for="y" :format="pct" :label-width="48" :ticks="3" />
            <DouChartLine y="errorRate" name="5xx 错误率" tone="danger" :line-width="1.5" />
            <DouChartMarker :y="1" label="告警线 1%" tone="danger" />
            <DouChartZoom v-model:x="range" :disabled="running" />
          </DouChart>
        </section>
        <section>
          <DouText as="h3" weight="bold">延迟</DouText>
          <DouChart :data="rows" x="time" :height="140" :loading="!rows.length">
            <DouChartAxis for="x" type="time" />
            <DouChartAxis for="y" :format="ms" :label-width="48" :ticks="3" />
            <DouChartLine y="p50" name="P50" :line-width="1.5" />
            <DouChartLine y="p95" name="P95" :line-width="1.5" />
            <DouChartMarker :y="SLO" label="目标 300ms" tone="danger" />
            <DouChartMarker v-for="span in breaches" :key="span[0]" :x="span" tone="danger" />
            <DouChartZoom v-model:x="range" :disabled="running" />
          </DouChart>
        </section>
        <section>
          <DouText as="h3" weight="bold">CPU</DouText>
          <DouChart :data="rows" x="time" :height="140" :loading="!rows.length">
            <DouChartAxis for="x" type="time" />
            <DouChartAxis for="y" :format="pct" :min="0" :max="100" :label-width="48" :ticks="3" />
            <DouChartArea y="cpu" name="CPU" />
            <DouChartMarker :y="[80, 100]" label="高负载" tone="warning" />
            <DouChartZoom v-model:x="range" :disabled="running" />
          </DouChart>
        </section>
      </DouCard>

      <DouCard title="告警" description="P95 延迟超过目标的时段" class="monitor__events">
        <DouTimeline v-if="events.length">
          <DouTimelineItem
            v-for="event in events"
            :key="event.key"
            :time="event.time"
            title="P95 延迟超过 300ms"
            tone="danger"
          >
            持续 {{ event.seconds }} 秒
          </DouTimelineItem>
        </DouTimeline>
        <DouEmpty v-else description="最近 5 分钟没有告警" size="sm" />
      </DouCard>
    </div>
  </div>
</template>

<style scoped>
.monitor {
  display: grid;
  gap: 16px;
  width: 100%;
  min-width: 0;
}
.monitor__cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
}
.monitor__cards .is-bad :deep(.dou-statistic__value) {
  color: var(--dou-color-danger-text);
}
.monitor__body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(220px, 280px);
  gap: 12px;
  align-items: start;
}
.monitor__charts {
  min-width: 0;
}
.monitor__charts section + section {
  margin-top: 16px;
}
.monitor__charts section {
  display: grid;
  gap: 4px;
}
.monitor__charts h3 {
  margin: 0;
  font-size: var(--dou-font-size-sm);
}
@media (max-width: 760px) {
  .monitor__body {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
