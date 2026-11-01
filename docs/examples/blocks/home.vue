<script setup>
import {
  DouDashboard,
  DouDashboardPalette,
  defineDashboardWidget,
  migrateDocument,
  replaceWidgets,
} from '@dou-ui/dashboard'
import { statWidget, textWidget } from '@dou-ui/dashboard/widgets'
import {
  CalendarClockIcon,
  LayoutGridIcon,
  ListTodoIcon,
  MegaphoneIcon,
  RedoIcon,
  RotateCcwIcon,
  UndoIcon,
} from '@dou-ui/icons'
import { DouButton, DouTooltip } from 'dou-ui'
import { onMounted, ref, watch } from 'vue'
import Notices from './home/notices.vue'
import Schedule from './home/schedule.vue'
import Shortcuts from './home/shortcuts.vue'
import ShortcutsSettings from './home/shortcuts-settings.vue'
import Todo from './home/todo.vue'

// 首页能放的格子：自己写的四种，加上内置的统计数字和文字
const widgets = [
  defineDashboardWidget({
    type: 'todo',
    label: '待办',
    icon: ListTodoIcon,
    size: { w: 4, h: 5, minW: 3, minH: 3 },
    defaultProps: { items: [] },
    component: Todo,
  }),
  defineDashboardWidget({
    type: 'schedule',
    label: '今日日程',
    icon: CalendarClockIcon,
    size: { w: 4, h: 5, minW: 3, minH: 3 },
    defaultProps: { events: [] },
    component: Schedule,
  }),
  defineDashboardWidget({
    type: 'notices',
    label: '公告',
    icon: MegaphoneIcon,
    size: { w: 6, h: 4, minW: 3, minH: 2 },
    defaultProps: { items: [] },
    component: Notices,
  }),
  defineDashboardWidget({
    type: 'shortcuts',
    label: '快捷入口',
    icon: LayoutGridIcon,
    size: { w: 4, h: 3, minW: 2, minH: 2 },
    defaultProps: { ids: ['leave', 'expense', 'report'] },
    component: Shortcuts,
    settings: ShortcutsSettings,
    fullscreen: false,
  }),
  statWidget(),
  textWidget(),
]

const defaults = () => ({
  version: 1,
  widgets: [
    {
      id: 'shortcuts',
      type: 'shortcuts',
      title: '快捷入口',
      props: {
        ids: ['leave', 'expense', 'report', 'approval', 'contacts', 'shipping'],
      },
      place: { lg: { x: 0, y: 0, w: 8, h: 3 } },
    },
    {
      id: 'approvals',
      type: 'stat',
      title: '待我审批',
      props: { value: 3, suffix: '件' },
      place: { lg: { x: 8, y: 0, w: 2, h: 3 } },
    },
    {
      id: 'leave',
      type: 'stat',
      title: '剩余年假',
      props: { value: 6.5, suffix: '天', precision: 1 },
      place: { lg: { x: 10, y: 0, w: 2, h: 3 } },
    },
    {
      id: 'todo',
      type: 'todo',
      title: '待办',
      props: {
        items: [
          { text: '确认上海仓的补货计划', done: false },
          { text: '回复设计评审意见', done: true },
          { text: '提交 10 月报销单', done: false },
          { text: '准备周五的分享', done: false },
        ],
      },
      place: { lg: { x: 0, y: 3, w: 4, h: 6 } },
    },
    {
      id: 'schedule',
      type: 'schedule',
      title: '今日日程',
      props: {
        events: [
          { time: '09:30', title: '站会', place: '3 楼小会议室' },
          { time: '11:00', title: '与戴兜对齐 Q4 目标', place: '线上' },
          { time: '14:00', title: '新人入职培训', place: '上海 · 培训室' },
          { time: '16:30', title: '版本发布评审' },
        ],
      },
      place: { lg: { x: 4, y: 3, w: 4, h: 6 } },
    },
    {
      id: 'notices',
      type: 'notices',
      title: '公告',
      props: {
        items: [
          {
            tag: '重要',
            tone: 'warning',
            title: '11 月 8 日晚间系统维护，期间无法提交审批',
            date: '11-01',
          },
          {
            tag: '行政',
            title: '上海办公室 12 楼茶水间重新开放',
            date: '10-30',
          },
          { title: '第四季度团建报名开始', date: '10-28' },
          { title: '报销流程调整说明', date: '10-25' },
        ],
      },
      place: { lg: { x: 8, y: 3, w: 4, h: 6 } },
    },
  ],
})

// 首页布局保存在浏览器里；服务端渲染时没有浏览器存储，所以挂载后再读
const STORAGE_KEY = 'dou-ui-block-home'
const doc = ref(defaults())
onMounted(() => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) doc.value = migrateDocument(JSON.parse(saved))
  } catch {
    // 无痕模式、存储被禁用或内容损坏时，用默认布局
  }
})
watch(doc, (value) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
  } catch {
    // 存不下时只是下次打开回到默认布局
  }
})

const dashboard = ref()
const editing = ref(false)

function reset() {
  dashboard.value.dispatch(replaceWidgets(dashboard.value.transaction(), defaults()))
}
</script>

<template>
  <div class="home">
    <DouPageHeader title="下午好，戴兜" subtitle="11 月 1 日 星期日" :show-back="false" :level="2">
      <template #extra>
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
          <DouButton size="sm" variant="ghost" @click="reset">
            <template #leading><RotateCcwIcon /></template>
            恢复默认
          </DouButton>
        </template>
        <DouButton size="sm" :variant="editing ? 'solid' : 'outline'" @click="editing = !editing">
          {{ editing ? '完成' : '自定义首页' }}
        </DouButton>
      </template>
    </DouPageHeader>
    <div class="home__body">
      <DouDashboardPalette v-if="editing" :for="dashboard" class="home__palette" />
      <DouDashboard
        ref="dashboard"
        v-model="doc"
        :widgets="widgets"
        :editable="editing"
        :breakpoints="{ lg: 640, md: 400, sm: 0 }"
        :row-height="44"
        :gap="12"
        label="首页"
        class="home__board"
      />
    </div>
  </div>
</template>

<style scoped>
.home {
  display: grid;
  /* a grid track grows to its widest content unless told not to */
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
  width: 100%;
  min-width: 0;
}
.home__body {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 16px;
}
.home__palette {
  flex: 0 0 auto;
}
.home__board {
  flex: 1 1 320px;
  min-width: 0;
}
@media (max-width: 640px) {
  .home__palette {
    flex: 1 1 100%;
    flex-direction: row;
    flex-wrap: wrap;
  }
}
</style>
