<script setup>
import { DouDashboard } from '@dou-ui/dashboard'
import { chartWidget } from '@dou-ui/dashboard/chart'
import { pivotWidget } from '@dou-ui/dashboard/pivot'
import { tableWidget } from '@dou-ui/dashboard/widgets'
import { csvExporter } from '@dou-ui/sheet/core'
import { xlsxExporter } from '@dou-ui/sheet-xlsx'
import { ref } from 'vue'
import { cityNames, sources } from './sales-data'

const widgets = [
  tableWidget(),
  chartWidget(),
  pivotWidget({
    fields: [
      { name: 'region', label: '地区' },
      { name: 'city', label: '城市', format: (code) => cityNames[code] ?? code },
      { name: 'amount', label: '销售额' },
    ],
  }),
]
// 表格、图表和透视表的标题栏会多出“导出”按钮，列出这几种文件
const exporters = [xlsxExporter, csvExporter]
const doc = ref({
  version: 1,
  widgets: [
    {
      id: 'pivot',
      type: 'pivot',
      title: '地区与城市',
      props: { source: 'orders', config: { rows: ['region', 'city'], values: ['amount'] } },
      place: { lg: { x: 0, y: 0, w: 6, h: 5 } },
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
        labels: { name: '地区', value: '销售额' },
      },
      place: { lg: { x: 6, y: 0, w: 6, h: 5 } },
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
      place: { lg: { x: 0, y: 5, w: 12, h: 5 } },
    },
  ],
})
</script>

<template>
  <DouDashboard
    v-model="doc"
    :widgets="widgets"
    :sources="sources"
    :exporters="exporters"
    :breakpoints="{ lg: 640, md: 400, sm: 0 }"
    :row-height="40"
    :gap="12"
    style="width: 100%"
  />
</template>
