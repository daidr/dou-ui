<script setup>
import { DouDashboard, defineDashboardWidget } from '@dou-ui/dashboard'
import { RefreshIcon } from '@dou-ui/icons'
import { DouButton } from 'dou-ui'
import { ref } from 'vue'
import StatusWidget from './status-widget.vue'

const widgets = [
  defineDashboardWidget({
    type: 'orders',
    label: '订单趋势',
    defaultProps: { points: [], fail: false },
    component: StatusWidget,
  }),
]
const doc = ref({
  version: 1,
  widgets: [
    {
      id: 'sh',
      type: 'orders',
      title: '上海仓订单',
      props: { points: [8, 12, 10, 15, 19, 17, 24], fail: true },
      place: { lg: { x: 0, y: 0, w: 6, h: 3 } },
    },
    {
      id: 'new',
      type: 'orders',
      title: '新仓订单',
      props: { points: [] },
      place: { lg: { x: 6, y: 0, w: 6, h: 3 } },
    },
    {
      id: 'old',
      type: 'orders',
      title: '旧仓订单',
      // 旧格式的设置：points 写成了文字
      props: { points: '8,12,10' },
      place: { lg: { x: 0, y: 3, w: 12, h: 3 } },
    },
  ],
})
// 换一个 key 让格子重新挂载，再取一次数
const round = ref(0)
</script>

<template>
  <div class="demo">
    <div>
      <DouButton size="sm" variant="soft" @click="round++">
        <template #leading><RefreshIcon /></template>
        重新加载
      </DouButton>
    </div>
    <DouDashboard
      :key="round"
      v-model="doc"
      :widgets="widgets"
      :breakpoints="{ lg: 480, md: 320, sm: 0 }"
      :row-height="56"
      :gap="12"
    />
  </div>
</template>

<style scoped>
.demo {
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: 12px;
}
</style>
