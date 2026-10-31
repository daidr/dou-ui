<script setup>
import {
  DouChart,
  DouChartArea,
  DouChartAxis,
  DouChartBar,
  DouChartLine,
  DouChartMarker,
  DouChartPie,
} from '@dou-ui/chart'
import { DownloadIcon } from '@dou-ui/icons'
import { computed, ref, useTemplateRef } from 'vue'

// 示例数据：一家连锁茶饮品牌在上海的经营情况，固定种子的随机数，每次打开都一样
function randomFrom(seed) {
  let state = seed
  return () => ((state = (state * 16807) % 2147483647) - 1) / 2147483646
}

const months = Array.from({ length: 12 }, (_, i) => `${i + 1}月`)
/** 今年只到 10 月 */
const THIS_MONTH = 10

const categories = [
  { name: '鲜果茶', share: 0.34, price: 26 },
  { name: '奶茶', share: 0.27, price: 22 },
  { name: '纯茶', share: 0.14, price: 18 },
  { name: '咖啡', share: 0.12, price: 24 },
  { name: '烘焙', share: 0.08, price: 16 },
  { name: '周边', share: 0.05, price: 48 },
]

/** 季节的起伏：夏季旺、春节前后淡 */
const season = (i) => 1 + 0.28 * Math.sin(((i - 3) / 12) * Math.PI * 2)

/** 每个月的销售额（万元），今年整体比去年高一些 */
function salesOf(share, seed) {
  const random = randomFrom(seed)
  return months.map((month, i) => {
    const last = 210 * season(i) * share * (0.94 + random() * 0.12)
    const now = i < THIS_MONTH ? last * (1.08 + random() * 0.12) : null
    return { month, now: now && round(now), last: round(last) }
  })
}
const round = (value) => Math.round(value * 10) / 10

const metrics = [
  { value: 'sales', label: '销售额' },
  { value: 'orders', label: '订单数' },
]
const metric = ref('sales')

// 点击品类的柱子，走势只看这个品类；再点一次回到全部
const category = ref(null)
function pick(event) {
  category.value = category.value === event.x ? null : event.x
}

const trend = computed(() => {
  const picked = categories.find((item) => item.name === category.value)
  const rows = salesOf(picked?.share ?? 1, picked ? categories.indexOf(picked) + 3 : 1)
  if (metric.value === 'sales') return rows
  // 订单数（千单）= 销售额 ÷ 客单价
  const price = picked?.price ?? 23
  const orders = (value) => value && Math.round((value * 100) / price) / 10
  return rows.map((row) => ({ ...row, now: orders(row.now), last: orders(row.last) }))
})

const unit = computed(() => (metric.value === 'sales' ? '万元' : '千单'))
const formatValue = (value) => `${value} ${unit.value}`
// 月目标：全部品类时才有
const target = computed(() => (category.value || metric.value !== 'sales' ? null : 240))

/* 统计卡片：今年 1–10 月和去年同期比 */
const total = salesOf(1, 1).slice(0, THIS_MONTH)
const sum = (list, key) => list.reduce((acc, row) => acc + row[key], 0)
const growth = (now, last) => (now - last) / last
const percent = (value) => `${(value * 100).toFixed(1)}%`
const share = (value) => `${Math.round(value * 100)}%`
const sales = { now: sum(total, 'now'), last: sum(total, 'last') }
const orders = { now: (sales.now * 10) / 23.6, last: (sales.last * 10) / 23 }
const cards = [
  { title: '销售额', value: sales.now, precision: 1, suffix: '万元', ...sales },
  { title: '订单数', value: orders.now, precision: 0, suffix: '千单', ...orders },
  {
    title: '客单价',
    value: (sales.now * 10) / orders.now,
    precision: 1,
    prefix: '¥',
    now: 23.6,
    last: 23,
  },
  { title: '退款率', value: 1.8, precision: 1, suffix: '%', now: 1.8, last: 2.3, upIsGood: false },
].map((card) => ({ ...card, change: growth(card.now, card.last) }))

/* 渠道占比和各区客群 */
const channels = [
  { channel: '门店', share: 46 },
  { channel: '小程序', share: 28 },
  { channel: '外卖平台', share: 19 },
  { channel: '团购', share: 7 },
]
const districts = [
  { name: '徐汇', returning: 6.8, fresh: 2.4 },
  { name: '静安', returning: 5.9, fresh: 2.9 },
  { name: '浦东', returning: 5.2, fresh: 3.6 },
  { name: '黄浦', returning: 4.1, fresh: 3.1 },
  { name: '长宁', returning: 3.6, fresh: 1.7 },
]
const thousand = (value) => `${value} 千人`

/* 导出走势图 */
const chart = useTemplateRef('chart')
function save(data, name) {
  const url = URL.createObjectURL(data)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
async function exportAs(format) {
  if (!chart.value) return
  const name = `${category.value ?? '全部品类'}${metric.value === 'sales' ? '销售额' : '订单数'}`
  if (format === 'png') save(await chart.value.exportPNG(), `${name}.png`)
  else save(new Blob([chart.value.exportSVG()], { type: 'image/svg+xml' }), `${name}.svg`)
}
</script>

<template>
  <div class="business">
    <DouPageHeader
      title="经营看板"
      subtitle="上海 · 2026 年 1–10 月"
      :show-back="false"
      :level="2"
    />

    <div class="business__cards">
      <DouCard v-for="card in cards" :key="card.title" padding="md">
        <DouStatistic
          :title="card.title"
          :value="card.value"
          :precision="card.precision"
          :prefix="card.prefix"
          :suffix="card.suffix"
          :trend="card.change >= 0 ? 'up' : 'down'"
          :up-is-good="card.upIsGood ?? true"
        >
          <template #footer>同比 {{ percent(Math.abs(card.change)) }}</template>
        </DouStatistic>
      </DouCard>
    </div>

    <DouCard
      title="月度走势"
      :description="`${category ?? '全部品类'} · 今年和去年同期对比`"
      class="business__trend"
    >
      <template #extra>
        <div class="business__tools">
          <DouButton v-if="category" size="sm" variant="ghost" @click="category = null">
            查看全部
          </DouButton>
          <DouSegmentedControl v-model="metric" :options="metrics" size="sm" />
          <DouDropdown placement="bottom-end" @select="exportAs">
            <DouButton size="sm" variant="outline" aria-label="导出" icon-only>
              <DownloadIcon />
            </DouButton>
            <template #menu>
              <DouDropdownItem value="png">图片（PNG）</DouDropdownItem>
              <DouDropdownItem value="svg">矢量图（SVG）</DouDropdownItem>
            </template>
          </DouDropdown>
        </div>
      </template>
      <DouChart ref="chart" :data="trend" x="month" :height="280">
        <DouChartAxis for="y" :format="formatValue" />
        <DouChartArea y="now" name="今年" smooth />
        <DouChartLine y="last" name="去年" smooth dashed :line-width="1.5" />
        <DouChartMarker v-if="target" :y="target" label="月目标" />
      </DouChart>
    </DouCard>

    <div class="business__row">
      <DouCard title="品类销售" description="点击品类，走势只看这个品类">
        <DouChart :data="categories" x="name" :height="240" horizontal @select="pick">
          <DouChartAxis for="y" :format="share" :ticks="4" />
          <DouChartBar y="share" name="销售占比" />
        </DouChart>
      </DouCard>
      <DouCard title="渠道占比" description="1–10 月各渠道的订单">
        <DouChart :data="channels" x="channel" :height="240">
          <DouChartPie value="share" name="渠道占比" :inner-radius="0.62">
            <div class="business__hole">{{ Math.round(orders.now).toLocaleString() }}</div>
            <div class="business__hole-label">千单</div>
          </DouChartPie>
        </DouChart>
      </DouCard>
      <DouCard title="各区客群" description="会员中新客和回头客的人数">
        <DouChart :data="districts" x="name" :height="240">
          <DouChartAxis for="y" :format="thousand" :ticks="4" />
          <DouChartBar y="returning" name="回头客" stack="people" />
          <DouChartBar y="fresh" name="新客" stack="people" />
        </DouChart>
      </DouCard>
    </div>
  </div>
</template>

<style scoped>
.business {
  display: grid;
  gap: 16px;
  width: 100%;
  min-width: 0;
}
.business__cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}
.business__tools {
  display: flex;
  align-items: center;
  gap: 8px;
}
.business__row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 12px;
}
.business__row > *,
.business__trend {
  min-width: 0;
}
.business__hole {
  font-size: 20px;
  font-weight: 600;
  line-height: 28px;
}
.business__hole-label {
  color: var(--dou-color-text-tertiary);
  font-size: 12px;
}
</style>
