<script setup lang="ts">
import type {
  GanttDocument,
  GanttMarker,
  GanttScale,
  GanttTask,
  GanttViewport,
} from '@dou-ui/gantt'
import {
  DouScheduler,
  type SchedulerCanvasScope,
  type SchedulerResource,
  type SchedulerRowInfo,
} from '@dou-ui/gantt/scheduler'
import { DouButton, DouSegmentedControl, DouTag, DouToolbar, DouToolbarSeparator } from 'dou-ui'
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue'

const scheduler = useTemplateRef('scheduler')
const scale = ref<GanttScale>('minute')
const follow = ref(true)
const tableWidth = ref(168)
const selectedResource = ref<string | null>('coder')
const collapsedGroups = ref<string[]>(['已完成'])
const hovering = ref(false)
const viewportRange = ref('')
const selectedNote = ref('点击泳道左列或空白轨道选中代理；悬停画布暂缓时钟推进且保持跟随。')

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
  { id: 'orchestrator', title: '调度器', group: '运行中', data: { state: 'running' } },
  { id: 'coder', title: '代码代理', group: '运行中', data: { state: 'running' } },
  { id: 'tester', title: '测试代理', group: '运行中', data: { state: 'idle' } },
  { id: 'reviewer', title: '评审代理', group: '运行中', data: { state: 'idle' } },
  { id: 'archiver', title: '构建归档', group: '已完成', data: { state: 'done' } },
]

const origin = Date.now()
const ago = (seconds: number) => origin - seconds * 1000
const clockNow = ref(origin)
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
      class: 'is-live-bar',
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
      class: 'is-live-bar',
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
    {
      id: 't-archive',
      title: '生成构建产物',
      resource: 'archiver',
      start: ago(660),
      end: ago(600),
      tone: 'success',
    },
  ],
  links: [],
}))

const markers = computed<GanttMarker[]>(() => [
  { id: 'm-start', date: ago(680), label: '任务启动', tone: 'primary' },
  {
    id: 'band-away',
    date: ago(340),
    endDate: ago(150),
    label: '离开期间',
    tone: 'warning',
  },
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
])

/** 20 秒桶粒度的并发数，用于顶部同步水位柱。 */
const concurrencyBuckets = computed(() => {
  const step = 20_000
  const from = ago(700)
  const to = liveEnd.value
  const list: { start: number; end: number; count: number }[] = []
  for (let t = from; t < to; t += step) {
    const mid = t + step / 2
    let count = 0
    for (const task of plan.value.tasks) {
      if (typeof task.start === 'number' && typeof task.end === 'number') {
        if (task.start <= mid && task.end >= mid) count++
      }
    }
    if (count > 0) list.push({ start: t, end: t + step, count })
  }
  return list
})

const handoffs = [
  { id: 'h1', from: 't-edit', to: 't-unit', label: '提交测试' },
  { id: 'h2', from: 't-unit', to: 't-review', label: '发起审阅' },
  { id: 'h3', from: 't-review', to: 't-unit-2', label: '回归验证' },
]

function handoffPaths(scope: SchedulerCanvasScope) {
  return handoffs.flatMap((edge) => {
    const a = scope.barBox(edge.from)
    const b = scope.barBox(edge.to)
    if (!a || !b) return []
    const x1 = a.right
    const y1 = a.centerY
    const x2 = b.left
    const y2 = b.centerY
    const dx = Math.max(24, Math.abs(x2 - x1) * 0.45)
    return [
      {
        id: edge.id,
        d: `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`,
        x2,
        y2,
      },
    ]
  })
}

function rowClass(info: SchedulerRowInfo) {
  if (info.kind === 'resource' && info.resource?.data?.state === 'done') return 'is-done-row'
  return undefined
}

function formatClock(ms: number) {
  return new Date(ms).toLocaleTimeString('zh-CN', { hour12: false })
}

function formatDuration(task: GanttTask) {
  if (typeof task.start !== 'number' || typeof task.end !== 'number') return ''
  const secs = Math.max(1, Math.round((task.end - task.start) / 1000))
  return secs >= 60 ? `${Math.floor(secs / 60)} 分 ${secs % 60} 秒` : `${secs} 秒`
}

function applyWindow(ms: number) {
  scheduler.value?.fit([clockNow.value - ms, clockNow.value])
}

function toggleFollow() {
  follow.value = !follow.value
}

function onViewportChange(vp: GanttViewport) {
  viewportRange.value = `${formatClock(vp.start)} – ${formatClock(vp.end)}`
}

function onResourceClick(resource: SchedulerResource | null) {
  if (!resource) return
  selectedNote.value = `已选中泳道「${resource.title}」（左列宽 ${tableWidth.value}px）`
}

function onMarkerClick(marker: GanttMarker) {
  const time = typeof marker.date === 'number' ? formatClock(marker.date) : String(marker.date)
  selectedNote.value = `事件「${marker.label ?? marker.id}」触发于 ${time}`
}

let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  timer = setInterval(() => {
    const now = Date.now()
    liveEnd.value = now
    if (!hovering.value) clockNow.value = now
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
        {{ follow ? (hovering ? '已暂缓（悬停中）' : '跟随当前中') : '回到现在' }}
      </DouButton>
      <span v-if="viewportRange" class="viewport-pill">视口 {{ viewportRange }}</span>
    </DouToolbar>

    <div @pointerenter="hovering = true" @pointerleave="hovering = false">
      <DouScheduler
        ref="scheduler"
        :model-value="plan"
        v-model:scale="scale"
        v-model:follow="follow"
        v-model:table-width="tableWidth"
        v-model:selected-resource="selectedResource"
        v-model:collapsed-groups="collapsedGroups"
        :resources="resources"
        :calendar="false"
        :now="clockNow"
        :markers="markers"
        :load="false"
        :rail-height="34"
        :row-class="rowClass"
        readonly
        style="width: 100%; height: 292px"
        @viewport-change="onViewportChange"
        @resource-click="onResourceClick"
        @marker-click="onMarkerClick"
      >
        <template #rail-header>
          <span class="rail-heading">并发水位</span>
        </template>

        <template #rail="{ xOf, height }">
          <div class="rail-track" :style="{ height: `${height}px` }">
            <span
              v-for="bucket in concurrencyBuckets"
              :key="bucket.start"
              class="rail-bar"
              :class="{ 'is-peak': bucket.count >= 3 }"
              :style="{
                left: `${xOf(bucket.start) ?? 0}px`,
                width: `${Math.max(2, (xOf(bucket.end) ?? 0) - (xOf(bucket.start) ?? 0) - 2)}px`,
                height: `${Math.min(height - 8, bucket.count * 7)}px`,
              }"
            />
          </div>
        </template>

        <template #group="{ title, count }">
          <span class="group-head">
            <span>{{ title }}</span>
            <DouTag size="sm" variant="soft">{{ count }}</DouTag>
          </span>
        </template>

        <template #resource="{ resource }">
          <span class="res-head">
            <span class="res-dot" :class="`is-${resource.data?.state ?? 'idle'}`" />
            <span class="res-name">{{ resource.title }}</span>
          </span>
        </template>

        <template #bar-content="{ task }">
          <span v-if="task.class === 'is-live-bar'" class="live-pulse" aria-hidden="true" />
        </template>

        <template #bar-tooltip="{ task, resource }">
          <div class="tip-box">
            <strong>{{ task.title }}</strong>
            <span>{{ resource?.title ?? '未分配' }} · {{ formatDuration(task) }}</span>
          </div>
        </template>

        <template #marker-tooltip="{ marker }">
          <div class="tip-box">
            <strong>{{ marker.label }}</strong>
            <span>{{
              typeof marker.date === 'number' ? formatClock(marker.date) : marker.date
            }}</span>
          </div>
        </template>

        <template #overlay="scope">
          <svg
            class="handoff-svg"
            :width="scope.totalWidth"
            :height="scope.totalHeight"
            aria-hidden="true"
          >
            <g v-for="edge in handoffPaths(scope)" :key="edge.id">
              <path class="handoff-arc" :d="edge.d" />
              <circle class="handoff-dot" :cx="edge.x2" :cy="edge.y2" r="3" />
            </g>
          </svg>
        </template>
      </DouScheduler>
    </div>

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

.viewport-pill {
  margin-left: auto;
  color: var(--dou-color-text-secondary);
  font-size: var(--dou-font-size-sm);
  font-variant-numeric: tabular-nums;
}

.rail-heading {
  padding: 0 12px;
  font-weight: var(--dou-font-weight-medium);
}

.rail-track {
  position: relative;
  width: 100%;
}

.rail-bar {
  position: absolute;
  bottom: 4px;
  border-radius: 2px 2px 0 0;
  background-color: color-mix(in oklab, var(--dou-color-primary) 55%, transparent);

  &.is-peak {
    background-color: var(--dou-color-warning);
  }
}

.group-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  width: 100%;
}

.res-head {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.res-dot {
  flex: none;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: var(--dou-color-text-tertiary);

  &.is-running {
    background-color: var(--dou-color-success);
  }
  &.is-done {
    background-color: var(--dou-color-border);
  }
}

.res-name {
  overflow: hidden;
  text-overflow: ellipsis;
}

.live-pulse {
  flex: none;
  width: 6px;
  height: 6px;
  margin-left: 6px;
  border-radius: 50%;
  background-color: var(--dou-color-success);
  box-shadow: 0 0 0 3px color-mix(in oklab, var(--dou-color-success) 26%, transparent);
}

.tip-box {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: var(--dou-font-size-sm);
}

.handoff-svg {
  display: block;
  overflow: visible;
}

.handoff-arc {
  fill: none;
  stroke: var(--dou-color-primary);
  stroke-width: 1.5;
  stroke-dasharray: 4 3;
  opacity: 0.7;
}

.handoff-dot {
  fill: var(--dou-color-primary);
}

:deep(.is-done-row) {
  opacity: 0.72;
}

.note {
  margin: 0;
  color: var(--dou-color-text-secondary);
  font-size: var(--dou-font-size-sm);
}
</style>
