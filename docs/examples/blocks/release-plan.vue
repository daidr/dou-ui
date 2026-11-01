<script setup lang="ts">
import {
  DouGantt,
  spanOf,
  takeBaseline,
  type GanttBaselineItem,
  type GanttColumn,
  type GanttLink,
  type GanttScale,
  type GanttTask,
} from '@dou-ui/gantt'
import { DownloadIcon, RedoIcon, UndoIcon } from '@dou-ui/icons'
import { downloadBlob, toast } from 'dou-ui'
import { computed, ref, useTemplateRef } from 'vue'
import { day } from '../gantt/dates'

// 示例数据：一次版本发布，从需求到上线
const owner = (name: string) => ({ data: { owner: name } })
const tasks = ref<GanttTask[]>([
  { id: 'req', title: '需求' },
  {
    id: 'r1',
    parent: 'req',
    title: '用户访谈',
    start: day(-12),
    end: day(-9),
    progress: 1,
    ...owner('戴兜'),
  },
  {
    id: 'r2',
    parent: 'req',
    title: '需求评审',
    type: 'milestone',
    start: day(-9),
    ...owner('戴兜'),
  },
  { id: 'des', title: '设计' },
  {
    id: 'd1',
    parent: 'des',
    title: '交互稿',
    start: day(-7),
    end: day(-3),
    progress: 1,
    ...owner('阿青'),
  },
  {
    id: 'd2',
    parent: 'des',
    title: '视觉稿',
    start: day(-4),
    end: day(1),
    progress: 0.7,
    ...owner('阿青'),
  },
  { id: 'dev', title: '开发' },
  {
    id: 'v1',
    parent: 'dev',
    title: '会员接口',
    start: day(-3),
    end: day(4),
    progress: 0.5,
    ...owner('林小满'),
  },
  {
    id: 'v2',
    parent: 'dev',
    title: '会员中心页面',
    start: day(2),
    end: day(9),
    progress: 0.1,
    ...owner('周舟'),
  },
  { id: 'v3', parent: 'dev', title: '支付接入', start: day(5), end: day(10), ...owner('林小满') },
  { id: 'qa', title: '测试' },
  { id: 'q1', parent: 'qa', title: '功能测试', start: day(11), end: day(14), ...owner('陈一') },
  { id: 'q2', parent: 'qa', title: '灰度发布', start: day(15), end: day(16), ...owner('戴兜') },
  {
    id: 'go',
    title: '正式上线',
    type: 'milestone',
    start: day(16),
    tone: 'primary',
    ...owner('戴兜'),
  },
])
const links = ref<GanttLink[]>([
  { id: 'l1', from: 'r1', to: 'r2' },
  { id: 'l2', from: 'r2', to: 'd1' },
  { id: 'l3', from: 'd1', to: 'd2', type: 'ss' },
  { id: 'l4', from: 'd2', to: 'v2' },
  { id: 'l5', from: 'v1', to: 'v3' },
  { id: 'l6', from: 'v2', to: 'q1' },
  { id: 'l7', from: 'v3', to: 'q1' },
  { id: 'l8', from: 'q1', to: 'q2' },
  { id: 'l9', from: 'q2', to: 'go' },
])

// 立项时保存的计划：视觉稿多用了两天，后面的开发和测试跟着推迟
const planned = takeBaseline(tasks.value).map((item) => {
  const shift = ['d2', 'v2', 'q1', 'q2', 'go', 'v3'].includes(item.id) ? -2 : 0
  if (!shift) return item
  const move = (date?: string) => {
    if (!date) return date
    const at = new Date(`${date}T00:00`)
    at.setDate(at.getDate() + shift)
    return `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`
  }
  return { ...item, start: move(item.start)!, end: move(item.end) }
})
const baseline = ref<GanttBaselineItem[]>(planned)
const showBaseline = ref(true)
const critical = ref(true)
// 不指定刻度，打开时按全部任务自动缩放
const scale = ref<GanttScale>()
const scales = [
  { value: 'day', label: '日' },
  { value: 'week', label: '周' },
  { value: 'month', label: '月' },
]

const columns: GanttColumn[] = [
  { key: 'title' },
  { key: 'owner', title: '负责人', width: 72 },
  { key: 'duration', width: 64, align: 'end' },
]

const gantt = useTemplateRef('gantt')

/* 概况 */
const leaves = computed(() => {
  const parents = new Set(tasks.value.map((task) => task.parent).filter(Boolean))
  return tasks.value.filter((task) => !parents.has(task.id) && task.type !== 'milestone')
})
const progress = computed(() => {
  let done = 0
  let total = 0
  for (const task of leaves.value) {
    const span = spanOf(task)
    if (!span) continue
    const length = span.end - span.start
    done += (task.progress ?? 0) * length
    total += length
  }
  return total ? Math.round((done / total) * 100) : 0
})
const daysLeft = computed(() => {
  const go = tasks.value.find((task) => task.id === 'go')
  const at = go?.start ? new Date(`${go.start}T00:00`).getTime() : Date.now()
  return Math.max(0, Math.ceil((at - Date.now()) / 86_400_000))
})
const behind = computed(() => {
  const plans = new Map(baseline.value.map((item) => [item.id, item]))
  const parents = new Set(tasks.value.map((task) => task.parent).filter(Boolean))
  return tasks.value.filter((task) => {
    if (parents.has(task.id)) return false
    const plan = plans.get(task.id)
    const now = spanOf(task)
    const then = plan && spanOf({ ...plan, title: '', type: task.type })
    return now && then && now.end > then.end
  }).length
})

function saveBaseline() {
  baseline.value = takeBaseline(tasks.value)
  showBaseline.value = true
  toast.success('已把当前日期保存为基线')
}

/* 导出 */
function download(data: Blob | string, name: string, type = 'text/plain') {
  downloadBlob(typeof data === 'string' ? new Blob([data], { type }) : data, name)
}

async function exportAs(kind: unknown) {
  const chart = gantt.value
  if (!chart) return
  if (kind === 'png') download(await chart.exportPNG(), '会员中心 2.0 排期.png')
  else if (kind === 'svg') download(chart.exportSVG(), '会员中心 2.0 排期.svg', 'image/svg+xml')
  else if (kind === 'csv') download(chart.exportCSV(), '会员中心 2.0 排期.csv', 'text/csv')
  else if (kind === 'print') chart.print()
}
</script>

<template>
  <div class="plan">
    <div class="plan__head">
      <div>
        <DouText as="h3" size="lg" weight="medium" class="plan__title"
          >会员中心 2.0 发布排期</DouText
        >
        <DouText variant="secondary" size="sm"
          >上海团队 · 拖动任务改日期，后续任务会跟着顺延</DouText
        >
      </div>
      <dl class="plan__stats">
        <div>
          <dt>整体进度</dt>
          <dd>{{ progress }}%</dd>
        </div>
        <div>
          <dt>距上线</dt>
          <dd>{{ daysLeft }} 天</dd>
        </div>
        <div>
          <dt>比计划推迟</dt>
          <dd :class="{ 'is-warning': behind }">{{ behind }} 项</dd>
        </div>
      </dl>
    </div>

    <div class="plan__bar">
      <DouToolbar size="sm" aria-label="排期操作">
        <DouButton
          variant="ghost"
          aria-label="撤销"
          :disabled="!gantt?.canUndo"
          @click="gantt?.undo()"
          ><UndoIcon
        /></DouButton>
        <DouButton
          variant="ghost"
          aria-label="重做"
          :disabled="!gantt?.canRedo"
          @click="gantt?.redo()"
          ><RedoIcon
        /></DouButton>
      </DouToolbar>
      <DouSegmentedControl v-model="scale" :options="scales" size="sm" aria-label="时间刻度" />
      <DouSwitch v-model="critical" size="sm">关键路径</DouSwitch>
      <DouSwitch v-model="showBaseline" size="sm">对比基线</DouSwitch>
      <span class="plan__spacer" />
      <DouButton size="sm" variant="outline" @click="saveBaseline">保存为基线</DouButton>
      <DouDropdown placement="bottom-end" @select="exportAs">
        <DouButton size="sm" variant="outline"
          ><template #leading><DownloadIcon /></template>导出</DouButton
        >
        <template #menu>
          <DouDropdownItem value="png">图片（PNG）</DouDropdownItem>
          <DouDropdownItem value="svg">矢量图（SVG）</DouDropdownItem>
          <DouDropdownItem value="csv">表格（CSV）</DouDropdownItem>
          <DouDropdownItem value="print" divided>打印</DouDropdownItem>
        </template>
      </DouDropdown>
    </div>

    <DouGantt
      ref="gantt"
      v-model:tasks="tasks"
      v-model:links="links"
      v-model:scale="scale"
      :columns="columns"
      :table-width="320"
      scheduling="auto"
      :critical="critical"
      :baseline="showBaseline ? baseline : undefined"
      :markers="[
        { date: day(10), label: '代码冻结', tone: 'warning' },
        { date: day(16), label: '上线', tone: 'primary' },
      ]"
      aria-label="会员中心 2.0 发布排期"
      class="plan__gantt"
    />
  </div>
</template>

<style scoped>
.plan {
  display: grid;
  gap: 16px;
  width: 100%;
  min-width: 0;
}
.plan__head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
}
.plan__title {
  margin: 0 0 4px;
}
.plan__stats {
  display: flex;
  gap: 24px;
  margin: 0;
}
.plan__stats dt {
  color: var(--dou-color-text-secondary);
  font-size: var(--dou-font-size-sm);
}
.plan__stats dd {
  margin: 2px 0 0;
  font-size: var(--dou-font-size-lg);
  font-weight: var(--dou-font-weight-medium);
  font-variant-numeric: tabular-nums;
}
.plan__stats dd.is-warning {
  color: var(--dou-color-warning-text);
}
.plan__bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}
.plan__spacer {
  flex: 1;
}
.plan__gantt {
  height: 460px;
}
</style>
