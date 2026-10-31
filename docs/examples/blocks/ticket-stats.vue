<script setup>
import { DouPivot } from '@dou-ui/pivot'
import { computed, ref } from 'vue'

// 示例数据：一个电商客服团队 9–10 月的 900 张工单（固定种子，每次打开都一样）
function randomFrom(seed) {
  let state = seed
  return () => ((state = (state * 16807) % 2147483647) - 1) / 2147483646
}
const random = randomFrom(31)
const pick = (list) => list[Math.floor(random() * list.length)]

const teams = ['账号', '支付', '物流', '售后']
const kinds = {
  账号: ['登录异常', '实名认证', '账号注销'],
  支付: ['重复扣款', '退款进度', '发票'],
  物流: ['延迟发货', '地址修改', '丢件'],
  售后: ['退换货', '质量问题', '价格保护'],
}
const channels = ['在线客服', '电话', '邮件']
/** 每种优先级的时限（小时），超过即为超时 */
const limits = { P1: 4, P2: 12, P3: 48 }

const tickets = Array.from({ length: 900 }, () => {
  const team = pick(teams)
  const priority = random() < 0.15 ? 'P1' : random() < 0.55 ? 'P2' : 'P3'
  const limit = limits[priority]
  // 大多数在时限内处理完，少数拖得很久
  const hours = Math.round(limit * (0.15 + random() * 0.9) * (random() < 0.12 ? 2.2 : 1) * 10) / 10
  const overdue = hours > limit ? 1 : 0
  return {
    team,
    kind: pick(kinds[team]),
    priority,
    channel: pick(channels),
    created: new Date(2026, 8, 1 + Math.floor(random() * 61)),
    hours,
    overdue,
    score: Math.max(1, Math.min(5, Math.round(4.6 - overdue * 1.8 - random() * 1.2))),
  }
})

const fields = [
  { name: 'team', label: '团队', order: teams },
  { name: 'kind', label: '问题' },
  { name: 'priority', label: '优先级' },
  { name: 'channel', label: '渠道', order: channels },
  { name: 'created', label: '创建日期', type: 'date' },
  { name: 'hours', label: '处理时长', type: 'number' },
  { name: 'overdue', label: '超时', type: 'number' },
  { name: 'score', label: '满意度', type: 'number' },
]

/* 统计卡片 */
const sum = (key) => tickets.reduce((acc, t) => acc + t[key], 0)
const cards = [
  { title: '工单数', value: tickets.length, precision: 0 },
  { title: '平均处理时长', value: sum('hours') / tickets.length, precision: 1, suffix: '小时' },
  { title: '超时率', value: (sum('overdue') / tickets.length) * 100, precision: 1, suffix: '%' },
  { title: '满意度', value: sum('score') / tickets.length, precision: 2, suffix: '/ 5' },
]

/* 三个值：工单数（数据条）、平均时长、超时率（计算值，色阶） */
const values = [
  { aggregate: 'count', label: '工单数', mark: 'bar' },
  {
    field: 'hours',
    aggregate: 'avg',
    label: '平均时长',
    format: { minimumFractionDigits: 1, maximumFractionDigits: 1 },
  },
  {
    formula: 'sum(overdue) / count()',
    label: '超时率',
    format: { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 },
    mark: { type: 'scale', tone: 'warning' },
  },
]

const by = ref('priority')
const groupings = [
  { value: 'priority', label: '按优先级' },
  { value: 'week', label: '按周' },
  { value: 'channel', label: '按渠道' },
]
const topOnly = ref(false)

const config = computed(() => ({
  rows: ['team', 'kind'],
  columns: by.value === 'week' ? [{ field: 'created', by: 'week' }] : [by.value],
  values,
  // 打开开关时，每个团队只看工单最多的 2 类问题
  filters: topOnly.value ? { kind: { top: { count: 2 } } } : {},
}))
const collapsed = ref({ rows: [['物流'], ['售后']] })
</script>

<template>
  <div class="tickets">
    <DouPageHeader
      title="工单统计"
      subtitle="客服中心 · 2026 年 9–10 月"
      :show-back="false"
      :level="2"
    />

    <div class="tickets__cards">
      <DouCard v-for="card in cards" :key="card.title" padding="md">
        <DouStatistic
          :title="card.title"
          :value="card.value"
          :precision="card.precision"
          :suffix="card.suffix"
        />
      </DouCard>
    </div>

    <DouCard title="各团队的工单" description="工单数画成数据条，超时率越高颜色越深">
      <div class="tickets__tools">
        <DouSegmentedControl v-model="by" :options="groupings" size="sm" />
        <DouSwitch v-model="topOnly" size="sm">只看主要问题</DouSwitch>
      </div>
      <DouPivot
        v-model:collapsed="collapsed"
        :config="config"
        :data="tickets"
        :fields="fields"
        :max-height="440"
        :column-width="96"
        size="sm"
        aria-label="各团队的工单"
      />
    </DouCard>
  </div>
</template>

<style scoped>
.tickets {
  display: grid;
  gap: 16px;
  width: 100%;
  min-width: 0;
}
.tickets__cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
}
.tickets__tools {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
  margin-bottom: 12px;
}
</style>
