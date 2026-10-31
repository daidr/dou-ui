<script setup lang="ts">
import {
  DouGantt,
  defineGanttExtension,
  parseTime,
  useGantt,
  type GanttLink,
  type GanttTask,
} from '@dou-ui/gantt'
import { computed, defineComponent, h, ref } from 'vue'
import { day } from './dates'

/** 一段不能排任务的日子：时间轴上画成一条带，移进去的改动会被拒绝。 */
function quietDays(from: string, to: string, label: string) {
  const band = defineComponent(() => {
    const gantt = useGantt()
    const box = computed(() => {
      const left = gantt.xOf(from)
      const right = gantt.xOf(to)
      return left == null || right == null ? null : { left, width: right - left }
    })
    return () =>
      box.value &&
      h('div', {
        class: 'quiet-days',
        style: { left: `${box.value.left}px`, width: `${box.value.width}px` },
        title: label,
      })
  })
  const start = parseTime(from)!.at
  const end = parseTime(to)!.at
  return defineGanttExtension({
    name: 'quiet-days',
    layers: { below: [band] },
    markers: () => [{ date: from, label, tone: 'warning' }],
    canMove: (move) => {
      const a = parseTime(move.start)!.at
      // 只有日期的结束是当天，算到那天结束
      const b = move.end ? parseTime(move.end)!.at + (move.end.length === 10 ? 1440 : 0) : a
      return b <= start || a >= end || `${label}期间不排任务`
    },
  })
}

/** 表格里加一列负责人，读任务的 data.owner。 */
const owners = defineGanttExtension({
  name: 'owners',
  columns: [{ key: 'owner', title: '负责人', width: 72 }],
})

const extensions = [owners, quietDays(day(8), day(10), '团建')]

const tasks = ref<GanttTask[]>([
  { id: 'ui', title: '设计稿', start: day(-2), end: day(2), data: { owner: '戴兜' } },
  { id: 'fe', title: '前端开发', start: day(3), end: day(7), data: { owner: '戴兜' } },
  { id: 'qa', title: '测试', start: day(11), end: day(13), data: { owner: '小林' } },
])
const links = ref<GanttLink[]>([{ id: 'l1', from: 'ui', to: 'fe' }])
</script>

<template>
  <DouGantt
    v-model:tasks="tasks"
    v-model:links="links"
    :extensions="extensions"
    :table-width="360"
    style="height: 220px"
  />
</template>

<style scoped>
:deep(.quiet-days) {
  position: absolute;
  top: 0;
  bottom: 0;
  background-image: repeating-linear-gradient(
    135deg,
    color-mix(in oklab, var(--dou-color-warning) 14%, transparent) 0 6px,
    transparent 6px 12px
  );
  pointer-events: none;
}
</style>
