<script setup>
import { computed, ref } from 'vue'

// 示例数据：固定种子的随机数，每次打开都一样
function series(seed, length, base, swing) {
  let state = seed
  const random = () => ((state = (state * 16807) % 2147483647) - 1) / 2147483646
  let value = base
  return Array.from({ length }, () => {
    value = Math.max(0, value + (random() - 0.48) * swing)
    return Math.round(value)
  })
}

const ranges = [
  { value: 7, label: '7 天' },
  { value: 30, label: '30 天' },
]
const days = ref(7)

const sum = (list) => list.reduce((total, value) => total + value, 0)
const trendOf = (list) => (list.at(-1) >= list[0] ? 'up' : 'down')

const metrics = computed(() => {
  const visits = series(11, days.value, 4200, 900)
  const deploys = series(5, days.value, 6, 4)
  const latency = series(23, days.value, 180, 30)
  const errors = series(37, days.value, 12, 8)
  return [
    { title: '访问量', value: sum(visits), data: visits, type: 'area' },
    { title: '部署次数', value: sum(deploys), data: deploys, type: 'bar' },
    {
      title: '平均响应时间',
      value: Math.round(sum(latency) / latency.length),
      suffix: 'ms',
      data: latency,
      type: 'line',
      upIsGood: false,
    },
    {
      title: '错误数',
      value: sum(errors),
      data: errors,
      type: 'bar',
      tone: 'danger',
      upIsGood: false,
    },
  ]
})

/* 部署日历 */
const pad = (n) => String(n).padStart(2, '0')
const format = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
const end = new Date()
const start = new Date(end)
start.setMonth(start.getMonth() - 5, 1)
let seed = 3
const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
const deployDays = []
const total = Math.round((end - start) / 86_400_000)
for (let i = 0; i <= total; i++) {
  const day = new Date(start)
  day.setDate(start.getDate() + i)
  // 周末很少部署
  const weekend = day.getDay() === 0 || day.getDay() === 6
  if (random() > (weekend ? 0.85 : 0.3))
    deployDays.push({ date: format(day), value: Math.ceil(random() * 6) })
}

/* 服务 */
const now = Date.now()
const services = [
  { name: 'dou-api', region: '上海', status: 'running', requests: series(41, 24, 900, 120) },
  { name: 'dou-docs', region: '上海', status: 'running', requests: series(42, 24, 320, 60) },
  { name: 'dou-image', region: '新加坡', status: 'deploying', requests: series(43, 24, 180, 50) },
  { name: 'dou-mail', region: '法兰克福', status: 'running', requests: series(44, 24, 60, 20) },
].map((service, i) => ({ ...service, updated: now - (i * 17 + 3) * 60_000 }))
// 所有服务的迷你图共用一个刻度，高度才能互相比较
const peak = Math.max(...services.flatMap((service) => service.requests))
const statuses = {
  running: { label: '运行中', tone: 'success' },
  deploying: { label: '部署中', tone: 'warning' },
}
const columns = [
  { key: 'name', title: '服务', minWidth: 120 },
  { key: 'region', title: '区域', minWidth: 96 },
  { key: 'status', title: '状态', minWidth: 96 },
  { key: 'requests', title: '近 24 小时请求', minWidth: 160 },
  { key: 'updated', title: '更新于', minWidth: 104 },
]
</script>

<template>
  <div class="dashboard">
    <DouPageHeader title="概览" subtitle="上海与海外节点的运行情况" :show-back="false" :level="2">
      <template #extra>
        <DouSegmentedControl v-model="days" :options="ranges" size="sm" />
      </template>
    </DouPageHeader>

    <div class="dashboard__metrics">
      <DouCard v-for="metric in metrics" :key="metric.title" padding="md">
        <DouStatistic
          :title="metric.title"
          :value="metric.value"
          :suffix="metric.suffix"
          :trend="trendOf(metric.data)"
          :up-is-good="metric.upIsGood ?? true"
          animated
        />
        <DouSparkline
          class="dashboard__spark"
          :data="metric.data"
          :type="metric.type"
          :tone="metric.tone"
          width="100%"
          :height="40"
          :markers="metric.type === 'bar' ? [] : ['last']"
        />
      </DouCard>
    </div>

    <div class="dashboard__row">
      <DouCard title="部署日历" description="最近半年每天的部署次数" class="dashboard__calendar">
        <DouCalendarHeatmap :data="deployDays" :start="format(start)" :end="format(end)" />
      </DouCard>
      <DouCard title="最近动态">
        <DouTimeline>
          <DouTimelineItem time="10:42" title="dou-image 开始部署" tone="warning">
            新加坡 · 由戴兜触发
          </DouTimelineItem>
          <DouTimelineItem time="09:15" title="dou-api 扩容到 6 个副本" tone="success">
            上海 · 自动扩容
          </DouTimelineItem>
          <DouTimelineItem time="昨天" title="错误数超过阈值" tone="danger">
            dou-mail · 已恢复
          </DouTimelineItem>
        </DouTimeline>
      </DouCard>
    </div>

    <section class="dashboard__section">
      <DouText as="h3" weight="bold">服务</DouText>
      <DouTable :data="services" :columns="columns" row-key="name">
        <template #cell-name="{ value }">
          <DouText mono>{{ value }}</DouText>
        </template>
        <template #cell-status="{ value }">
          <DouTag :tone="statuses[value].tone" size="sm">{{ statuses[value].label }}</DouTag>
        </template>
        <template #cell-requests="{ value }">
          <DouSparkline :data="value" :min="0" :max="peak" type="area" :width="128" :height="24" />
        </template>
        <template #cell-updated="{ value }">
          <DouText variant="secondary"><DouRelativeTime :value="value" /></DouText>
        </template>
      </DouTable>
    </section>
  </div>
</template>

<style scoped>
.dashboard {
  display: grid;
  gap: 16px;
  width: 100%;
  min-width: 0;
}
.dashboard__metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}
.dashboard__spark {
  display: block;
  margin-top: 12px;
}
.dashboard__row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(240px, 320px);
  gap: 12px;
}
.dashboard__section {
  display: grid;
  gap: 12px;
  min-width: 0;
}
.dashboard__section h3 {
  margin: 0;
}
.dashboard__row > * {
  min-width: 0;
}
@media (max-width: 760px) {
  .dashboard__row {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
