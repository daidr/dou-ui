<script setup lang="ts">
import { formatTime, spanOf, type GanttTask } from '@dou-ui/gantt'
import {
  DouScheduler,
  type SchedulerMenuTarget,
  type SchedulerMove,
  type SchedulerRange,
  type SchedulerResource,
} from '@dou-ui/gantt/scheduler'
import { ChevronLeftIcon, ChevronRightIcon, EditIcon, PlusIcon } from '@dou-ui/icons'
import { toast } from 'dou-ui'
import { computed, reactive, ref, useTemplateRef } from 'vue'
import { workday } from '../gantt/dates'

// 示例数据：上海办公室的会议室
const rooms: (SchedulerResource & { floor: string; seats: number })[] = [
  { id: '301', title: '301 观澜', group: '3 楼', floor: '3', seats: 6 },
  { id: '302', title: '302 枕流', group: '3 楼', floor: '3', seats: 12 },
  { id: '303', title: '303 听雨', group: '3 楼', floor: '3', seats: 4 },
  { id: '501', title: '501 大会议室', group: '5 楼', floor: '5', seats: 20 },
  { id: '502', title: '502 小剧场', group: '5 楼', floor: '5', seats: 40 },
]
const people = ['戴兜', '阿青', '林小满', '周舟', '陈一']

const today = workday(0)
const at = (date: string, time: string) => `${date} ${time}`
let nextId = 1
const meeting = (
  room: string,
  title: string,
  from: string,
  to: string,
  host: string,
  date = today,
) => ({
  id: `m${nextId++}`,
  title,
  resource: room,
  start: at(date, from),
  end: at(date, to),
  data: { host },
})
const tasks = ref<GanttTask[]>([
  meeting('302', '周会', '09:30', '10:30', '戴兜'),
  meeting('301', '候选人面试', '10:00', '11:00', '阿青'),
  meeting('301', '设计评审', '14:00', '15:30', '阿青'),
  meeting('303', '一对一', '11:00', '11:30', '林小满'),
  meeting('501', '新人培训', '13:00', '17:00', '周舟'),
  meeting('502', '季度分享会', '16:00', '18:00', '戴兜'),
  meeting('302', '需求对齐', '15:00', '16:00', '陈一'),
  meeting('302', '周会', '09:30', '10:30', '戴兜', workday(1)),
  meeting('501', '客户来访', '10:00', '12:00', '林小满', workday(1)),
])

/* 日期与楼层 */
const pad = (n: number) => String(n).padStart(2, '0')
const date = ref(today)
function shift(days: number) {
  const next = new Date(`${date.value}T00:00`)
  do next.setDate(next.getDate() + days)
  while (next.getDay() === 0 || next.getDay() === 6)
  date.value = `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}`
}
const dateText = computed(() => {
  const d = new Date(`${date.value}T00:00`)
  return `${d.getMonth() + 1}月${d.getDate()}日 周${'日一二三四五六'[d.getDay()]}`
})
const floor = ref('all')
const floors = [
  { value: 'all', label: '全部' },
  { value: '3', label: '3 楼' },
  { value: '5', label: '5 楼' },
]
const shown = computed(() =>
  rooms.filter((room) => floor.value === 'all' || room.floor === floor.value),
)
const roomOf = (id?: string) => rooms.find((room) => room.id === id)

/* 同一间会议室的预约不能重叠 */
function overlaps(
  room: string | undefined,
  start: string,
  end: string | undefined,
  except?: string,
) {
  const own = spanOf({ id: '', title: '', start, end })!
  return tasks.value.some((task) => {
    if (task.id === except || task.resource !== room) return false
    const span = spanOf(task)
    return !!span && span.start < own.end && own.start < span.end
  })
}
const canMove = (move: SchedulerMove) =>
  !move.resource ||
  !overlaps(move.resource, move.start, move.end, move.task.id) ||
  '这段时间已有预约'

/* 新建与编辑 */
const scheduler = useTemplateRef('scheduler')
const open = ref(false)
const editing = ref<GanttTask | null>(null)
const draft = reactive({ title: '', room: '301', host: '戴兜', from: '10:00', to: '11:00' })

function book(range: Partial<SchedulerRange> = {}) {
  editing.value = null
  Object.assign(draft, {
    title: '',
    room: range.resource ?? shown.value[0]!.id,
    host: '戴兜',
    from: range.start?.slice(11) || '10:00',
    to: range.end?.slice(11) || '11:00',
  })
  open.value = true
}

function edit(task: GanttTask) {
  editing.value = task
  Object.assign(draft, {
    title: task.title,
    room: task.resource,
    host: task.data?.host ?? '戴兜',
    from: task.start?.slice(11),
    to: task.end?.slice(11),
  })
  open.value = true
}

function save() {
  const start = at(date.value, draft.from)
  const end = at(date.value, draft.to)
  if (!draft.title.trim()) return void toast.warning('请填写会议主题')
  if (draft.to <= draft.from) return void toast.warning('结束时间要晚于开始时间')
  if (overlaps(draft.room, start, end, editing.value?.id))
    return void toast.warning(`${roomOf(draft.room)?.title} 这段时间已有预约`)
  const fields = {
    title: draft.title.trim(),
    resource: draft.room,
    start,
    end,
    data: { host: draft.host },
  }
  const id = editing.value?.id
  scheduler.value?.transact((tr) => {
    if (id) tr.updateTask(id, fields)
    else tr.addTask({ id: `m${nextId++}`, tone: 'primary', ...fields })
  })
  open.value = false
}

function remove() {
  const id = editing.value?.id
  if (id) scheduler.value?.transact((tr) => tr.removeTask(id))
  open.value = false
}

const contextMenu = (target: SchedulerMenuTarget) => {
  if (target.kind === 'task')
    return [{ key: 'edit', label: '编辑预约', icon: EditIcon, run: () => edit(target.task) }]
  if (!target.resource) return []
  // the hour under the pointer
  const hour = Math.floor(target.time / 60) * 60
  const resource = target.resource.id
  return [
    {
      key: 'book',
      label: '在这里预约',
      icon: PlusIcon,
      run: () => book({ resource, start: formatTime(hour), end: formatTime(hour + 60) }),
    },
  ]
}

const roomOptions = computed(() =>
  rooms.map((room) => ({ value: room.id, label: `${room.title} · ${room.seats} 人` })),
)
const hostOptions = people.map((name) => ({ value: name, label: name }))
</script>

<template>
  <div class="rooms">
    <div class="rooms__bar">
      <div class="rooms__date">
        <DouButton size="sm" variant="ghost" aria-label="前一个工作日" @click="shift(-1)"
          ><ChevronLeftIcon
        /></DouButton>
        <DouText weight="medium" class="rooms__day">{{ dateText }}</DouText>
        <DouButton size="sm" variant="ghost" aria-label="后一个工作日" @click="shift(1)"
          ><ChevronRightIcon
        /></DouButton>
        <DouButton size="sm" variant="outline" :disabled="date === today" @click="date = today"
          >今天</DouButton
        >
      </div>
      <DouSegmentedControl v-model="floor" :options="floors" size="sm" aria-label="楼层" />
      <span class="rooms__spacer" />
      <DouButton size="sm" tone="primary" @click="book()"><PlusIcon />预约会议室</DouButton>
    </div>

    <DouScheduler
      ref="scheduler"
      v-model:tasks="tasks"
      :resources="shown"
      :range="[date, date]"
      :calendar="{ hours: ['09:00', '18:00'] }"
      scale="hour"
      :load="false"
      :table-width="180"
      :can-move="canMove"
      :context-menu="contextMenu"
      aria-label="会议室预约"
      class="rooms__chart"
      @range-select="book"
      @task-dblclick="edit"
    >
      <template #resource="{ resource }">
        <span class="rooms__room">
          {{ resource.title }}
          <DouText variant="tertiary" size="sm">{{ roomOf(resource.id)?.seats }} 人</DouText>
        </span>
      </template>
    </DouScheduler>
    <DouText variant="tertiary" size="sm">
      在空白处拖出一段时间即可预约；拖动会议可以改时间或换会议室，双击编辑。
    </DouText>

    <DouDialog v-model:open="open" :title="editing ? '编辑预约' : '预约会议室'" :width="420">
      <DouForm :model="draft" @submit="save">
        <DouFormItem label="会议主题">
          <DouInput v-model="draft.title" placeholder="例如 周会" />
        </DouFormItem>
        <DouFormItem label="会议室">
          <DouSelect v-model="draft.room" :options="roomOptions" />
        </DouFormItem>
        <DouFormItem label="时间">
          <div class="rooms__time">
            <DouInputTime v-model="draft.from" :minute-step="15" />
            <DouText variant="tertiary">至</DouText>
            <DouInputTime v-model="draft.to" :minute-step="15" />
          </div>
        </DouFormItem>
        <DouFormItem label="发起人">
          <DouSelect v-model="draft.host" :options="hostOptions" />
        </DouFormItem>
      </DouForm>
      <template #footer="{ close }">
        <DouButton
          v-if="editing"
          tone="danger"
          variant="ghost"
          class="rooms__delete"
          @click="remove"
          >取消预约</DouButton
        >
        <DouButton variant="outline" @click="close">关闭</DouButton>
        <DouButton tone="primary" @click="save">{{ editing ? '保存' : '预约' }}</DouButton>
      </template>
    </DouDialog>
  </div>
</template>

<style scoped>
.rooms {
  display: grid;
  gap: 12px;
  width: 100%;
  min-width: 0;
}
.rooms__bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}
.rooms__date {
  display: flex;
  align-items: center;
  gap: 4px;
}
.rooms__day {
  min-width: 96px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}
.rooms__spacer {
  flex: 1;
}
.rooms__chart {
  height: 320px;
}
.rooms__room {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
}
.rooms__time {
  display: flex;
  align-items: center;
  gap: 8px;
}
.rooms__time > :not(.dou-text) {
  flex: 1;
}
.rooms__delete {
  margin-right: auto;
}
</style>
