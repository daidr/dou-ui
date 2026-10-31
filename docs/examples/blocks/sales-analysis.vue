<script setup>
import { DouChart, DouChartAxis, DouChartBar } from '@dou-ui/chart'
import { DownloadIcon } from '@dou-ui/icons'
import { DouPivot, DouPivotFields } from '@dou-ui/pivot'
import { toast } from 'dou-ui'
import { computed, ref, shallowRef, useTemplateRef } from 'vue'
import { fields, orders } from '../pivot/orders'

// 示例数据：一家茶饮连锁 2026 年的 2400 笔订单（固定种子，每次打开都一样）

/* 常用的几种看法，一键切换；之后也可以在字段面板里自己拖 */
const views = [
  {
    value: 'region',
    label: '大区 × 季度',
    config: {
      rows: ['region', 'city'],
      columns: [{ field: 'date', by: 'quarter' }],
      values: ['amount'],
    },
    collapsed: { rows: [['华东'], ['华南'], ['华北'], ['西南']] },
  },
  {
    value: 'category',
    label: '品类占比',
    config: {
      rows: ['region'],
      columns: ['category'],
      values: [{ field: 'amount', show: 'percentOfRow', mark: 'scale' }],
    },
    collapsed: {},
  },
  {
    value: 'channel',
    label: '渠道 × 月份',
    config: {
      rows: [{ field: 'date', by: 'month' }],
      columns: ['channel'],
      values: ['amount', { field: 'amount', show: 'runningTotal', label: '累计销售额' }],
      valuesOn: 'rows',
    },
    collapsed: {},
  },
]
const view = ref('region')
const config = ref(views[0].config)
const collapsed = ref(views[0].collapsed)
function showView(value) {
  const next = views.find((item) => item.value === value)
  config.value = next.config
  collapsed.value = next.collapsed
}

/* 透视图：表格展开到哪一层，图就画到哪一层 */
const pivot = useTemplateRef('pivot')
const chart = computed(
  () => pivot.value?.toChartRows({ valueIndex: 0 }) ?? { x: 'label', rows: [], series: [] },
)
const chartNote = computed(() =>
  view.value === 'region'
    ? '跟随表格：展开一个大区，图里换成它的城市'
    : '跟随表格：画出表格里的第一个值',
)
const stacked = computed(() => !config.value.values?.some((v) => typeof v === 'object' && v.show))

/* 点击一个数字，在抽屉里列出这一格的订单 */
const open = ref(false)
const cell = shallowRef(null)
const money = new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' })
const day = new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric' })
const columns = [
  { key: 'date', title: '日期', width: 80 },
  { key: 'city', title: '城市', width: 72 },
  { key: 'category', title: '品类', width: 72 },
  { key: 'channel', title: '渠道', width: 80 },
  { key: 'amount', title: '金额', align: 'end' },
]
const records = computed(() =>
  (cell.value?.records() ?? []).map((order, i) => ({
    id: i,
    date: day.format(order.date),
    city: order.city,
    category: order.category,
    channel: order.channel,
    amount: money.format(order.amount),
  })),
)
// labels 是表格里写出的组名，比如“2026年1月”
const where = computed(() => {
  if (!cell.value) return ''
  const { row, column } = cell.value.labels
  return [...row, ...column].join(' · ') || '全部订单'
})
function showDetails(next) {
  cell.value = next
  open.value = true
}

/* 导出 */
function save(text, name, type) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
async function exportAs(kind) {
  const name = views.find((item) => item.value === view.value).label
  if (kind === 'copy') {
    await pivot.value.copy({ all: true })
    toast.success('已复制，可以粘贴到电子表格里')
  } else if (kind === 'csv') save(pivot.value.toCSV(), `销售分析 · ${name}.csv`, 'text/csv')
  else pivot.value.print({ title: `销售分析 · ${name}` })
}
</script>

<template>
  <div class="sales">
    <DouPageHeader
      title="销售分析"
      :subtitle="`2026 年 · ${orders.length.toLocaleString()} 笔订单`"
      :show-back="false"
      :level="2"
    >
      <template #extra>
        <DouDropdown placement="bottom-end" @select="exportAs">
          <DouButton variant="outline">
            <template #leading><DownloadIcon /></template>
            导出
          </DouButton>
          <template #menu>
            <DouDropdownItem value="copy">复制整张表</DouDropdownItem>
            <DouDropdownItem value="csv">下载 CSV</DouDropdownItem>
            <DouDropdownItem value="print">打印</DouDropdownItem>
          </template>
        </DouDropdown>
      </template>
    </DouPageHeader>

    <DouSegmentedControl
      v-model="view"
      class="sales__views"
      :options="views"
      @update:model-value="showView"
    />

    <div class="sales__main">
      <DouPivotFields
        v-model:config="config"
        class="sales__fields"
        :data="orders"
        :fields="fields"
      />
      <div class="sales__content">
        <DouPivot
          ref="pivot"
          v-model:config="config"
          v-model:collapsed="collapsed"
          :data="orders"
          :fields="fields"
          :max-height="420"
          aria-label="销售分析"
          @cell-click="showDetails"
        />

        <!-- 透视图放在表格下方，和字段面板并排 -->
        <DouCard title="透视图" :description="chartNote">
          <DouChart :data="chart.rows" :x="chart.x" :height="260">
            <DouChartAxis for="y" :format="chart.series[0]?.format" />
            <DouChartBar
              v-for="s in chart.series"
              :key="s.key"
              :y="s.key"
              :name="s.name"
              :stack="stacked"
            />
          </DouChart>
        </DouCard>
      </div>
    </div>

    <DouDrawer v-model:open="open" :title="`${where}（${records.length} 笔）`" :size="520">
      <DouTable
        :data="records"
        :columns="columns"
        row-key="id"
        virtual
        size="sm"
        max-height="100%"
      />
    </DouDrawer>
  </div>
</template>

<style scoped>
.sales {
  display: grid;
  gap: 16px;
  width: 100%;
  min-width: 0;
}
.sales__views {
  justify-self: start;
  max-width: 100%;
}
.sales__main {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  min-width: 0;
}
.sales__fields {
  flex: none;
  width: 280px;
}
.sales__content {
  display: grid;
  flex: 1;
  gap: 12px;
  min-width: 0;
}
@media (max-width: 639px) {
  .sales__main {
    flex-direction: column;
    align-items: stretch;
  }
  .sales__fields {
    width: auto;
  }
  /* in a column, flex: 1 would take the height away */
  .sales__content {
    flex: none;
  }
}
</style>
