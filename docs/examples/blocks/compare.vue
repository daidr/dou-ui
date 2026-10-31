<script setup>
import {
  DouChart,
  DouChartAxis,
  DouChartBar,
  DouChartBrush,
  DouChartLine,
  DouChartMarker,
  DouChartScatter,
} from '@dou-ui/chart'
import { computed, ref } from 'vue'

// 示例数据：上海 60 家门店，固定种子的随机数，每次打开都一样
let seed = 19
const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646

/* 月度销售额：今年和去年 */
const months = Array.from({ length: 10 }, (_, i) => {
  const season = 1 + 0.25 * Math.sin(((i - 3) / 12) * Math.PI * 2)
  const last = Math.round(1800 * season * (0.95 + random() * 0.1))
  // 3 月新开了 6 家店，之后增长明显
  const now = Math.round(last * (i < 2 ? 0.97 + random() * 0.06 : 1.08 + random() * 0.1))
  return { month: `${i + 1}月`, now, last, growth: (now - last) / last }
})
const wan = (value) => `${value} 万元`
// 去掉末尾的 .0：20%、12.3%
const percent = (value) => `${Number((value * 100).toFixed(1))}%`

/* 门店：面积、月销售额，以及所在的区 */
const districts = ['徐汇', '静安', '浦东', '黄浦', '长宁', '杨浦']
const stores = Array.from({ length: 60 }, (_, i) => {
  const area = Math.round(60 + random() * 240)
  // 黄浦、静安的店坪效更高
  const district = districts[i % districts.length]
  const lift = district === '黄浦' || district === '静安' ? 1.25 : 1
  const sales = Math.round((area * 0.32 * lift + (random() - 0.5) * 36) * 10) / 10
  return { name: `${district} ${Math.floor(i / districts.length) + 1} 号店`, district, area, sales }
})
const mean = (list, key) => list.reduce((sum, row) => sum + row[key], 0) / (list.length || 1)
const all = {
  area: mean(stores, 'area'),
  sales: mean(stores, 'sales'),
  yield: mean(stores, 'sales') / mean(stores, 'area'),
}

// 框选出的门店，和全部门店的平均值比较
const picked = ref([])
const brushX = ref(null)
const brushY = ref(null)
function onSelect(event) {
  picked.value = event.rows
}
function clear() {
  brushX.value = null
  brushY.value = null
  picked.value = []
}

const summary = computed(() => {
  const list = picked.value
  const sales = mean(list, 'sales')
  const area = mean(list, 'area')
  const yieldOf = area ? (sales / area) * 10_000 : 0
  return [
    { title: '门店数', value: list.length, suffix: '家' },
    { title: '平均月销售额', value: sales, precision: 1, suffix: '万元', base: all.sales },
    { title: '平均面积', value: area, precision: 0, suffix: '㎡', base: all.area },
    { title: '坪效', value: yieldOf, precision: 0, suffix: '元/㎡', base: all.yield * 10_000 },
  ].map((item) => ({
    ...item,
    change: item.base ? (item.value - item.base) / item.base : null,
  }))
})

const sorted = computed(() => {
  const list = [...picked.value]
  list.sort((a, b) => b.sales - a.sales)
  return list
})
const columns = [
  { key: 'name', title: '门店', minWidth: 96 },
  { key: 'area', title: '面积', align: 'end', minWidth: 64 },
  { key: 'sales', title: '月销售额', align: 'end', minWidth: 80 },
  { key: 'yield', title: '坪效', align: 'end', minWidth: 72 },
]
const yieldOfRow = (row) => Math.round((row.sales / row.area) * 10_000)
</script>

<template>
  <div class="compare">
    <DouPageHeader
      title="门店对比"
      subtitle="上海 60 家门店 · 2026 年 1–10 月"
      :show-back="false"
      :level="2"
    />

    <DouCard title="月度销售额" description="今年和去年同期，折线是同比增长">
      <DouChart :data="months" x="month" :height="280">
        <DouChartAxis for="y" :format="wan" :ticks="4" />
        <DouChartAxis for="y2" :format="percent" :ticks="4" />
        <DouChartBar y="now" name="今年" />
        <DouChartBar y="last" name="去年" />
        <DouChartLine y="growth" name="同比" axis="y2" />
        <DouChartMarker :x="['3月', '10月']" label="新开 6 家店之后" />
      </DouChart>
    </DouCard>

    <div class="compare__row">
      <DouCard title="门店分布" description="拖动框选一片门店，和全部门店的平均值比较">
        <DouChart :data="stores" x="area" :height="320">
          <DouChartAxis for="x" title="面积（㎡）" />
          <DouChartAxis for="y" title="月销售额（万元）" />
          <DouChartScatter y="sales" name="门店" label="name" />
          <DouChartMarker :x="Math.round(all.area)" label="平均面积" />
          <DouChartMarker :y="Math.round(all.sales * 10) / 10" label="平均销售额" />
          <DouChartBrush v-model:x="brushX" v-model:y="brushY" axis="xy" @select="onSelect" />
        </DouChart>
      </DouCard>

      <DouCard
        title="选中的门店"
        description="面积单位是 ㎡，销售额是万元，坪效是元/㎡"
        class="compare__picked"
      >
        <template v-if="picked.length" #extra>
          <DouButton size="sm" variant="ghost" @click="clear">清除</DouButton>
        </template>
        <template v-if="picked.length">
          <div class="compare__summary">
            <DouStatistic
              v-for="item in summary"
              :key="item.title"
              :title="item.title"
              :value="item.value"
              :precision="item.precision"
              :suffix="item.suffix"
              :trend="item.change === null ? undefined : item.change >= 0 ? 'up' : 'down'"
            >
              <template v-if="item.change !== null" #footer>
                比全部 {{ item.change >= 0 ? '高' : '低' }} {{ percent(Math.abs(item.change)) }}
              </template>
            </DouStatistic>
          </div>
          <DouTable :data="sorted" :columns="columns" row-key="name" size="sm" :max-height="240">
            <template #cell-sales="{ value }">{{ value.toFixed(1) }}</template>
            <template #cell-yield="{ row }">{{ yieldOfRow(row).toLocaleString() }}</template>
          </DouTable>
        </template>
        <DouEmpty v-else description="在门店分布图里拖动，框选一片门店" size="sm" />
      </DouCard>
    </div>
  </div>
</template>

<style scoped>
.compare {
  display: grid;
  gap: 16px;
  width: 100%;
  min-width: 0;
}
.compare__row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 12px;
  align-items: start;
}
.compare__row > * {
  min-width: 0;
}
.compare__summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  margin-bottom: 16px;
}
@media (max-width: 760px) {
  .compare__row {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
