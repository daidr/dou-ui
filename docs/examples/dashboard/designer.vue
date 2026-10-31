<script setup>
import { DouDashboard, DouDashboardPalette } from '@dou-ui/dashboard'
import { RedoIcon, UndoIcon } from '@dou-ui/icons'
import { DouButton, DouSwitch, DouTooltip } from 'dou-ui'
import { ref } from 'vue'
import { widgets } from './widgets'

const editing = ref(true)
// 示例区域较窄，所以把 12 列的起点从默认的 1024px 调到 640px
const dashboard = ref()
// 整个仪表盘是一份 JSON 文档，保存、读取都由应用自己做
const doc = ref({
  version: 1,
  widgets: [
    {
      id: 'orders',
      type: 'stat',
      title: '今日订单',
      props: { value: 1286, suffix: '单' },
      place: { lg: { x: 0, y: 0, w: 3, h: 2 } },
    },
    {
      id: 'visits',
      type: 'stat',
      title: '访问量',
      props: { value: 23904, suffix: '次' },
      place: { lg: { x: 3, y: 0, w: 3, h: 2 } },
    },
    {
      id: 'sales',
      type: 'trend',
      title: '近 10 天销售额',
      props: { points: [32, 28, 35, 41, 38, 46, 52, 49, 58, 63] },
      place: { lg: { x: 6, y: 0, w: 6, h: 4 } },
    },
    {
      id: 'memo',
      type: 'note',
      props: { text: '戴兜：周五前确认上海仓的补货计划。' },
      place: { lg: { x: 0, y: 2, w: 6, h: 2 } },
    },
  ],
})
</script>

<template>
  <div class="demo">
    <div class="bar">
      <DouSwitch v-model="editing" class="switch" size="sm">编辑</DouSwitch>
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
      </template>
    </div>
    <div class="body">
      <DouDashboardPalette v-if="editing" :for="dashboard" class="palette" />
      <DouDashboard
        ref="dashboard"
        v-model="doc"
        :widgets="widgets"
        :editable="editing"
        :breakpoints="{ lg: 640, md: 400, sm: 0 }"
        :row-height="56"
        :gap="12"
        class="board"
      />
    </div>
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
  align-items: center;
  gap: 4px;
  min-height: 32px;
}
.switch {
  margin-right: 8px;
}
.body {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 16px;
}
.palette {
  flex: 0 0 auto;
}
.board {
  flex: 1 1 320px;
  min-width: 0;
}
@media (max-width: 640px) {
  .palette {
    flex: 1 1 100%;
    flex-direction: row;
    flex-wrap: wrap;
  }
}
</style>
