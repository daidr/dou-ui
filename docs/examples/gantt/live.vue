<script setup lang="ts">
import type { GanttDocument, GanttMarker, GanttScale } from '@dou-ui/gantt'
import { DouScheduler, type SchedulerResource } from '@dou-ui/gantt/scheduler'
import { DouButton, DouSegmentedControl, DouToolbar, DouToolbarSeparator } from 'dou-ui'
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue'

const scheduler = useTemplateRef('scheduler')
const scale = ref<GanttScale>('minute')
const follow = ref(true)
const selectedNote = ref('拖动时间轴可暂停跟随并回看历史；点击泳道圆点查看离散事件。')

const scales = [
  { label: '秒', value: 'second' },
  { label: '分', value: 'minute' },
  { label: '时', value: 'hour' },
]

const windows = [
  { label: '2 分钟', ms: 2 * 60_000 },
  { label: '15 分钟', ms: 15 * 60_000 },
  { label: '1 小时', ms: 60 * 60_000 },
]

const resources: SchedulerResource[] = [
  { id: 'orchestrator', title: '调度器' },
  { id: 'coder', title: '代码代理' },
  { id: 'tester', title: '测试代理' },
  { id: 'reviewer', title: '评审代理' },
]

const origin = Date.now()
const ago = (seconds: number) => origin - seconds * 1000
const liveEnd = ref(origin)

const plan = computed<GanttDocument>(() => ({
  version: 1,
  tasks: [
    {
      id: 't-plan',
      title: '拆解任务',
      resource: 'orchestrator',
      start: ago(680),
      end: ago(590),
      tone: 'primary',
    },
    {
      id: 't-dispatch',
      title: '分配并行子任务',
      resource: 'orchestrator',
      start: ago(585),
      end: ago(540),
    },
    {
      id: 't-watch',
      title: '汇总进度',
      resource: 'orchestrator',
      start: ago(220),
      end: liveEnd.value,
      tone: 'primary',
    },
    {
      id: 't-read',
      title: '读取源码',
      resource: 'coder',
      start: ago(535),
      end: ago(490),
    },
    {
      id: 't-edit',
      title: '实现核心逻辑',
      resource: 'coder',
      start: ago(480),
      end: ago(260),
      tone: 'primary',
    },
    {
      id: 't-fix',
      title: '修复边界用例',
      resource: 'coder',
      start: ago(160),
      end: liveEnd.value,
      tone: 'success',
    },
    {
      id: 't-unit',
      title: '运行单元测试',
      resource: 'tester',
      start: ago(255),
      end: ago(215),
      tone: 'warning',
    },
    {
      id: 't-unit-2',
      title: '回归验证',
      resource: 'tester',
      start: ago(120),
      end: ago(45),
      tone: 'success',
    },
    {
      id: 't-review',
      title: '代码静态评审',
      resource: 'reviewer',
      start: ago(200),
      end: ago(75),
      tone: 'primary',
    },
  ],
  links: [],
}))

const markers: GanttMarker[] = [
  { id: 'm-start', date: ago(680), label: '任务启动', tone: 'primary' },
  {
    id: 'ev-fail',
    resource: 'tester',
    date: ago(215),
    label: '用例失败（时区偏移）',
    tone: 'danger',
  },
  {
    id: 'ev-ask',
    resource: 'coder',
    date: ago(180),
    label: '请求确认方案',
    tone: 'warning',
  },
  {
    id: 'ev-pass',
    resource: 'tester',
    date: ago(45),
    label: '全部测试通过',
    tone: 'success',
  },
  {
    id: 'ev-lgtm',
    resource: 'reviewer',
    date: ago(75),
    label: '评审通过',
    tone: 'success',
  },
]

function applyWindow(ms: number) {
  const now = Date.now()
  scheduler.value?.fit([now - ms, now])
}

function toggleFollow() {
  follow.value = !follow.value
}

function onMarkerClick(marker: GanttMarker) {
  const time = new Date(marker.date).toLocaleTimeString('zh-CN', { hour12: false })
  selectedNote.value = `事件「${marker.label ?? marker.id}」触发于 ${time}`
}

let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  timer = setInterval(() => {
    liveEnd.value = Date.now()
  }, 1000)
})
onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})
</script>

<template>
  <div class="demo">
    <DouToolbar size="sm" aria-label="实时时间线控制">
      <DouSegmentedControl v-model="scale" :options="scales" size="sm" />
      <DouToolbarSeparator />
      <DouButton v-for="w in windows" :key="w.label" variant="ghost" @click="applyWindow(w.ms)">
        {{ w.label }}
      </DouButton>
      <DouToolbarSeparator />
      <DouButton
        :variant="follow ? 'soft' : 'outline'"
        :tone="follow ? 'primary' : 'neutral'"
        @click="toggleFollow"
      >
        {{ follow ? '跟随当前中' : '回到现在' }}
      </DouButton>
    </DouToolbar>

    <DouScheduler
      ref="scheduler"
      :model-value="plan"
      v-model:scale="scale"
      v-model:follow="follow"
      :resources="resources"
      :calendar="false"
      :markers="markers"
      :load="false"
      :table-width="136"
      readonly
      style="width: 100%; height: 204px"
      @marker-click="onMarkerClick"
    />

    <p class="note">{{ selectedNote }}</p>
  </div>
</template>

<style scoped>
.demo {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
}

.note {
  margin: 0;
  color: var(--dou-color-text-secondary);
  font-size: var(--dou-font-size-sm);
}
</style>
