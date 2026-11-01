<script setup>
import {
  DouDashboard,
  DouDashboardFilterBar,
  migrateDocument,
  replaceWidgets,
} from '@dou-ui/dashboard'
import { chartWidget } from '@dou-ui/dashboard/chart'
import { pivotWidget } from '@dou-ui/dashboard/pivot'
import { statWidget, tableWidget, textWidget } from '@dou-ui/dashboard/widgets'
import { DownloadIcon, PrinterIcon, RedoIcon, RotateCcwIcon, UndoIcon } from '@dou-ui/icons'
import { DouButton, DouSwitch, DouTooltip } from 'dou-ui'
import { onMounted, ref, watch } from 'vue'
import { categories, channels, regions, sources } from './ops-board/data'

const widgets = [
  statWidget(),
  textWidget(),
  tableWidget(),
  chartWidget(),
  pivotWidget({
    fields: [
      { name: 'region', label: '地区', order: regions },
      { name: 'category', label: '品类', order: categories },
      { name: 'amount', label: '销售额' },
    ],
  }),
]

const stat = (id, title, props, place) => ({
  id,
  type: 'stat',
  title,
  props: { source: 'overview', ...props },
  place: { lg: place },
})

// 默认布局；“恢复默认”时回到这里
const defaults = () => ({
  version: 1,
  widgets: [
    stat(
      'amount',
      '销售额',
      { field: 'amount', prefix: '¥', trend: 'trend', delta: 'delta' },
      { x: 0, y: 0, w: 3, h: 3 },
    ),
    stat(
      'orders',
      '订单数',
      { field: 'orders', suffix: '单', trend: 'orderTrend' },
      { x: 3, y: 0, w: 3, h: 3 },
    ),
    stat(
      'average',
      '客单价',
      { field: 'average', prefix: '¥', precision: 1 },
      { x: 6, y: 0, w: 3, h: 3 },
    ),
    stat(
      'conversion',
      '转化率',
      { field: 'conversion', suffix: '%', precision: 2 },
      { x: 9, y: 0, w: 3, h: 3 },
    ),
    {
      id: 'daily',
      type: 'chart',
      title: '每日销售额',
      props: {
        source: 'daily',
        kind: 'area',
        x: 'date',
        y: ['amount'],
        labels: { amount: '销售额' },
      },
      place: { lg: { x: 0, y: 3, w: 8, h: 4 } },
    },
    {
      id: 'channel',
      type: 'chart',
      title: '渠道',
      props: {
        source: 'channel',
        kind: 'pie',
        x: 'name',
        y: ['amount'],
        labels: { amount: '销售额' },
        filter: 'channel',
      },
      place: { lg: { x: 8, y: 3, w: 4, h: 4 } },
    },
    {
      id: 'category',
      type: 'chart',
      title: '各品类销售额',
      props: {
        source: 'category',
        kind: 'bar',
        x: 'name',
        y: ['amount'],
        labels: { amount: '销售额' },
        filter: 'category',
      },
      place: { lg: { x: 0, y: 7, w: 4, h: 5 } },
    },
    {
      id: 'pivot',
      type: 'pivot',
      title: '地区与品类',
      props: {
        source: 'records',
        config: { rows: ['region'], columns: ['category'], values: ['amount'] },
        filter: true,
      },
      place: { lg: { x: 0, y: 12, w: 12, h: 5 } },
    },
    {
      id: 'top',
      type: 'table',
      title: '热销商品',
      props: {
        source: 'top',
        rowKey: 'name',
        columns: [
          { key: 'rank', title: '排名' },
          { key: 'name', title: '商品' },
          { key: 'amount', title: '销售额（元）' },
          { key: 'orders', title: '订单数' },
        ],
      },
      place: { lg: { x: 4, y: 7, w: 5, h: 5 } },
    },
    {
      id: 'note',
      type: 'text',
      title: '说明',
      props: {
        text: '10 月运营数据，戴兜整理。\n点饼图、柱子或透视表的单元格，其他格子会跟着筛选。月底三天是促销期。',
        size: 'sm',
      },
      place: { lg: { x: 9, y: 7, w: 3, h: 5 } },
    },
  ],
})

// 布局保存在浏览器里，下次打开还是改过的样子；读不到时用默认布局
const STORAGE_KEY = 'dou-ui-block-ops-board'
function restore() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) return migrateDocument(JSON.parse(saved))
  } catch {
    // 无痕模式、存储被禁用或内容损坏时，忽略保存的布局
  }
  return defaults()
}
// 服务端渲染时没有浏览器存储，所以挂载后再读
const doc = ref(defaults())
onMounted(() => (doc.value = restore()))
watch(doc, (value) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
  } catch {
    // 存不下时只是下次打开回到默认布局
  }
})

const dashboard = ref()
const editing = ref(false)
const filters = ref({ date: ['2026-10-01', '2026-10-31'] })

// 恢复默认也是一次普通的修改，可以撤销
function reset() {
  dashboard.value.dispatch(replaceWidgets(dashboard.value.transaction(), defaults()))
}

async function download() {
  const blob = await dashboard.value.exportPNG()
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = 'ops-board.png'
  link.click()
  setTimeout(() => URL.revokeObjectURL(link.href), 1000)
}
</script>

<template>
  <div class="ops">
    <DouPageHeader title="运营大盘" subtitle="网店 · 2026 年 10 月" :show-back="false" :level="2" />
    <DouDashboardFilterBar
      :for="dashboard"
      :fields="[
        { type: 'date-range', key: 'date', label: '日期' },
        { type: 'select', key: 'channel', label: '渠道', options: channels },
        { type: 'select', key: 'region', label: '地区', options: regions },
      ]"
    >
      <DouSwitch v-model="editing" size="sm">编辑布局</DouSwitch>
      <template v-if="editing">
        <DouTooltip content="撤销" shortcut="mod+z">
          <DouButton
            size="sm"
            variant="ghost"
            aria-label="撤销"
            :disabled="!dashboard?.canUndo"
            @click="dashboard.undo()"
          >
            <UndoIcon />
          </DouButton>
        </DouTooltip>
        <DouTooltip content="重做" shortcut="mod+shift+z">
          <DouButton
            size="sm"
            variant="ghost"
            aria-label="重做"
            :disabled="!dashboard?.canRedo"
            @click="dashboard.redo()"
          >
            <RedoIcon />
          </DouButton>
        </DouTooltip>
        <DouTooltip content="恢复默认布局">
          <DouButton size="sm" variant="ghost" aria-label="恢复默认布局" @click="reset">
            <RotateCcwIcon />
          </DouButton>
        </DouTooltip>
      </template>
      <template v-else>
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
      </template>
    </DouDashboardFilterBar>
    <DouDashboard
      ref="dashboard"
      v-model="doc"
      v-model:filters="filters"
      :widgets="widgets"
      :sources="sources"
      :editable="editing"
      :breakpoints="{ lg: 720, md: 440, sm: 0 }"
      :row-height="44"
      :gap="12"
      label="运营大盘"
    />
  </div>
</template>

<style scoped>
.ops {
  display: grid;
  /* a grid track grows to its widest content unless told not to */
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
  width: 100%;
  min-width: 0;
}
</style>
