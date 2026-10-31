<script setup>
import { DouDashboard, DouDashboardFilterBar } from '@dou-ui/dashboard'
import { chartWidget } from '@dou-ui/dashboard/chart'
import { pivotWidget } from '@dou-ui/dashboard/pivot'
import { statWidget, tableWidget, textWidget } from '@dou-ui/dashboard/widgets'
import { DownloadIcon, PrinterIcon } from '@dou-ui/icons'
import { DouButton, DouSwitch, DouTooltip } from 'dou-ui'
import { ref } from 'vue'
import { cityNames, regionNames, sources } from './sales-data'

// 内置的格子类型，可以和自己写的格子类型放在一起
const widgets = [
  statWidget(),
  textWidget(),
  tableWidget(),
  chartWidget(),
  pivotWidget({
    fields: [
      { name: 'region', label: '地区' },
      // 数据里是城市代码，显示成名字；点击后筛选的值仍是代码
      { name: 'city', label: '城市', format: (code) => cityNames[code] ?? code },
      { name: 'amount', label: '销售额' },
    ],
  }),
]
const dashboard = ref()
const editing = ref(false)
const filters = ref({})
const doc = ref({
  version: 1,
  widgets: [
    {
      id: 'amount',
      type: 'stat',
      title: '销售额',
      props: { source: 'overview', field: 'amount', prefix: '¥', trend: 'trend', delta: 'delta' },
      place: { lg: { x: 0, y: 0, w: 4, h: 3 } },
    },
    {
      id: 'orders',
      type: 'stat',
      title: '订单数',
      props: { source: 'overview', field: 'orders', unit: '单' },
      place: { lg: { x: 4, y: 0, w: 4, h: 3 } },
    },
    {
      id: 'note',
      type: 'text',
      title: '说明',
      props: { text: '10 月销售情况，戴兜整理。\n点柱状图或透视表筛选其他格子。', size: 'sm' },
      place: { lg: { x: 8, y: 0, w: 4, h: 3 } },
    },
    {
      id: 'regions',
      type: 'chart',
      title: '各地区销售额',
      props: {
        source: 'region',
        kind: 'bar',
        x: 'name',
        y: ['value'],
        labels: { value: '销售额' },
        filterKey: 'region',
      },
      place: { lg: { x: 0, y: 3, w: 6, h: 5 } },
    },
    {
      id: 'pivot',
      type: 'pivot',
      title: '地区与城市',
      props: {
        source: 'orders',
        config: { rows: ['region', 'city'], values: ['amount'] },
        filter: true,
      },
      place: { lg: { x: 6, y: 3, w: 6, h: 5 } },
    },
    {
      id: 'detail',
      type: 'table',
      title: '明细',
      props: {
        source: 'orders',
        columns: [
          { key: 'date', title: '日期' },
          { key: 'cityName', title: '城市' },
          { key: 'amount', title: '销售额' },
          { key: 'orders', title: '订单数' },
        ],
      },
      place: { lg: { x: 0, y: 8, w: 12, h: 5 } },
    },
  ],
})

async function download() {
  const blob = await dashboard.value.exportPNG()
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = '销售看板.png'
  link.click()
  URL.revokeObjectURL(link.href)
}
</script>

<template>
  <div class="demo">
    <DouDashboardFilterBar
      :for="dashboard"
      :fields="[{ type: 'select', key: 'region', label: '地区', options: regionNames }]"
    >
      <DouSwitch v-model="editing" size="sm">编辑</DouSwitch>
      <DouTooltip content="导出图片">
        <DouButton size="sm" variant="ghost" aria-label="导出图片" @click="download">
          <DownloadIcon />
        </DouButton>
      </DouTooltip>
      <DouTooltip content="打印">
        <DouButton size="sm" variant="ghost" aria-label="打印" @click="dashboard.print()">
          <PrinterIcon />
        </DouButton>
      </DouTooltip>
    </DouDashboardFilterBar>
    <DouDashboard
      ref="dashboard"
      v-model="doc"
      v-model:filters="filters"
      :widgets="widgets"
      :sources="sources"
      :editable="editing"
      :breakpoints="{ lg: 640, md: 400, sm: 0 }"
      :row-height="40"
      :gap="12"
    />
  </div>
</template>

<style scoped>
.demo {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
}
</style>
