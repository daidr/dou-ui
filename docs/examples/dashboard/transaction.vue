<script setup lang="ts">
import { DouDashboard, type DashboardDocument, type DashboardTransaction } from '@dou-ui/dashboard'
import { DouButton } from 'dou-ui'
import { ref, shallowRef, useTemplateRef } from 'vue'
import { widgets } from './widgets'

const dashboard = useTemplateRef<InstanceType<typeof DouDashboard>>('dashboard')
const doc = ref<DashboardDocument>({
  version: 1,
  widgets: [
    {
      id: 'orders',
      type: 'stat',
      title: '今日订单',
      props: { value: 1286, suffix: '单' },
      place: { lg: { x: 0, y: 0, w: 6, h: 2 } },
    },
    {
      id: 'memo',
      type: 'note',
      props: { text: '戴兜：周五前确认上海仓的补货计划。' },
      place: { lg: { x: 6, y: 0, w: 6, h: 2 } },
    },
  ],
})

// 用事务修改的文档可以撤销；每次修改都会触发 change
const last = shallowRef<DashboardTransaction>()
function toWeek() {
  const board = dashboard.value!
  const tr = board.transaction()
  tr.update('orders', { title: '本周订单', props: { value: 8930, suffix: '单' } })
  tr.setMeta('origin', 'toolbar')
  board.dispatch(tr)
}
</script>

<template>
  <div class="demo">
    <div class="bar">
      <DouButton size="sm" @click="toWeek">改成本周订单</DouButton>
      <DouButton
        size="sm"
        variant="ghost"
        :disabled="!dashboard?.canUndo"
        @click="dashboard?.undo()"
      >
        撤销
      </DouButton>
      <DouButton
        size="sm"
        variant="ghost"
        :disabled="!dashboard?.canRedo"
        @click="dashboard?.redo()"
      >
        重做
      </DouButton>
    </div>
    <DouDashboard
      ref="dashboard"
      v-model="doc"
      :widgets="widgets"
      :breakpoints="{ lg: 480, md: 320, sm: 0 }"
      :row-height="56"
      :gap="12"
      @change="last = $event"
    />
    <pre class="log">{{
      last
        ? `来源 ${last.meta.origin}，步骤：\n${JSON.stringify(last.steps, null, 2)}`
        : '还没有修改'
    }}</pre>
  </div>
</template>

<style scoped>
.demo {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
}
.bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.log {
  max-height: 200px;
  margin: 0;
  overflow: auto;
  padding: 12px;
  border-radius: var(--dou-radius-container);
  background: var(--dou-color-bg-muted);
  font-family: var(--dou-font-family-mono);
  font-size: var(--dou-font-size-sm);
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
