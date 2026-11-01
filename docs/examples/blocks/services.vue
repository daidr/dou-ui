<script setup>
import { DouDashboard, defineDashboardWidget } from '@dou-ui/dashboard'
import { chartWidget } from '@dou-ui/dashboard/chart'
import { statWidget, tableWidget } from '@dou-ui/dashboard/widgets'
import { RefreshIcon, ServerIcon } from '@dou-ui/icons'
import { DouButton, DouTooltip } from 'dou-ui'
import { ref } from 'vue'
import { sources } from './services/data'
import ServiceList from './services/service-list.vue'

// 自己写的格子类型：服务列表，点一个服务筛选其他格子
const serviceWidget = defineDashboardWidget({
  type: 'services',
  label: '服务列表',
  icon: ServerIcon,
  size: { w: 4, h: 6, minW: 3, minH: 4 },
  defaultProps: { source: 'services' },
  component: ServiceList,
})
const widgets = [serviceWidget, statWidget(), chartWidget(), tableWidget()]

const stat = (id, title, props, x) => ({
  id,
  type: 'stat',
  title,
  props: { source: 'summary', ...props },
  place: { lg: { x, y: 0, w: 3, h: 3 } },
})

const doc = ref({
  version: 1,
  widgets: [
    stat(
      'rps',
      '请求量',
      { field: 'rps', suffix: '次/秒', trend: 'rpsTrend', delta: 'rpsDelta' },
      0,
    ),
    stat('p95', 'P95 延迟', { field: 'p95', suffix: 'ms', precision: 0, trend: 'p95Trend' }, 3),
    stat(
      'errors',
      '错误率',
      { field: 'errorRate', suffix: '%', precision: 2, trend: 'errorTrend' },
      6,
    ),
    stat('availability', '可用率', { field: 'availability', suffix: '%', precision: 1 }, 9),
    {
      id: 'services',
      type: 'services',
      title: '服务',
      props: { source: 'services' },
      place: { lg: { x: 0, y: 3, w: 5, h: 6 } },
    },
    {
      id: 'latency',
      type: 'chart',
      title: '延迟（最近 3 分钟）',
      props: {
        source: 'latency',
        kind: 'line',
        x: 'time',
        y: ['p50', 'p95'],
        labels: { p50: 'P50', p95: 'P95' },
      },
      place: { lg: { x: 5, y: 3, w: 7, h: 6 } },
    },
    {
      id: 'endpoints',
      type: 'chart',
      title: '各接口错误数',
      props: {
        source: 'errors',
        kind: 'bar',
        x: 'name',
        y: ['count'],
        labels: { count: '错误数' },
        horizontal: true,
      },
      place: { lg: { x: 0, y: 9, w: 5, h: 5 } },
    },
    {
      id: 'incidents',
      type: 'table',
      title: '告警记录',
      props: {
        source: 'incidents',
        columns: [
          { key: 'time', title: '时间' },
          { key: 'service', title: '服务' },
          { key: 'title', title: '内容' },
          { key: 'state', title: '状态' },
        ],
      },
      place: { lg: { x: 5, y: 9, w: 7, h: 5 } },
    },
  ],
})

const dashboard = ref()
const filters = ref({})
</script>

<template>
  <div class="services-page">
    <DouPageHeader title="服务大盘" subtitle="生产环境 · 上海" :show-back="false" :level="2">
      <template #extra>
        <span class="services-page__hint">每 5 秒刷新</span>
        <DouTooltip content="立即刷新">
          <DouButton size="sm" variant="ghost" aria-label="立即刷新" @click="dashboard.refresh()">
            <RefreshIcon />
          </DouButton>
        </DouTooltip>
      </template>
    </DouPageHeader>
    <DouDashboard
      ref="dashboard"
      v-model="doc"
      v-model:filters="filters"
      :widgets="widgets"
      :sources="sources"
      :breakpoints="{ lg: 720, md: 440, sm: 0 }"
      :row-height="44"
      :gap="12"
      label="服务大盘"
    />
  </div>
</template>

<style scoped>
.services-page {
  display: grid;
  /* a grid track grows to its widest content unless told not to */
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
  width: 100%;
  min-width: 0;
}
.services-page__hint {
  color: var(--dou-color-text-tertiary);
  font-size: var(--dou-font-size-sm);
}
</style>
