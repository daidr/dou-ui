<script setup>
import { DouDashboard, DouDashboardFilterBar } from '@dou-ui/dashboard'
import { RefreshIcon } from '@dou-ui/icons'
import { DouButton, DouTooltip } from 'dou-ui'
import { ref } from 'vue'
import { loads, regionNames, sources } from './sales-data'
import { salesWidgets } from './sales-widgets'

const dashboard = ref()
const filters = ref({})
const fields = [
  { type: 'select', key: 'region', label: '地区', options: regionNames },
  { type: 'date-range', key: 'date', label: '日期' },
  { type: 'search', key: 'keyword', label: '城市', placeholder: '例如 上海' },
]
const doc = ref({
  version: 1,
  widgets: [
    {
      id: 'amount',
      type: 'metric',
      title: '销售额',
      props: { source: 'summary', field: 'amount', prefix: '¥' },
      place: { lg: { x: 0, y: 0, w: 3, h: 2 } },
    },
    {
      id: 'orders',
      type: 'metric',
      title: '订单数',
      props: { source: 'summary', field: 'orders', unit: '单' },
      place: { lg: { x: 3, y: 0, w: 3, h: 2 } },
    },
    {
      id: 'trend',
      type: 'trend',
      title: '每日销售额',
      props: { source: 'trend' },
      place: { lg: { x: 6, y: 0, w: 6, h: 2 } },
    },
    {
      id: 'regions',
      type: 'bars',
      title: '各地区',
      props: { source: 'region', filterKey: 'region' },
      place: { lg: { x: 0, y: 2, w: 6, h: 4 } },
    },
    {
      id: 'cities',
      type: 'bars',
      title: '城市前五',
      props: { source: 'city', filterKey: 'keyword' },
      place: { lg: { x: 6, y: 2, w: 6, h: 4 } },
    },
  ],
})
</script>

<template>
  <div class="demo">
    <DouDashboardFilterBar :for="dashboard" :fields="fields">
      <DouTooltip content="刷新">
        <DouButton size="sm" variant="ghost" aria-label="刷新" @click="dashboard.refresh()">
          <RefreshIcon />
        </DouButton>
      </DouTooltip>
    </DouDashboardFilterBar>
    <DouDashboard
      ref="dashboard"
      v-model="doc"
      v-model:filters="filters"
      :widgets="salesWidgets"
      :sources="sources"
      :breakpoints="{ lg: 640, md: 400, sm: 0 }"
      :row-height="56"
      :gap="12"
    />
    <p class="note">已发出 {{ loads }} 次请求。filters：{{ JSON.stringify(filters) }}</p>
  </div>
</template>

<style scoped>
.demo {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
}
.note {
  margin: 0;
  color: var(--dou-color-text-tertiary);
  font-size: var(--dou-font-size-sm);
}
</style>
