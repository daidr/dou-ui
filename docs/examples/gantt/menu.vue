<script setup lang="ts">
import { DouGantt, formatTime, type GanttDocument, type GanttMenuTarget } from '@dou-ui/gantt'
import { CheckIcon, FlagIcon } from '@dou-ui/icons'
import type { ContextMenuItem } from 'dou-ui'
import { ref, useTemplateRef } from 'vue'
import { day } from './dates'

const plan = ref<GanttDocument>({
  version: 1,
  tasks: [
    { id: 'ui', title: '设计稿', start: day(-2), end: day(2), progress: 0.6 },
    { id: 'fe', title: '前端开发', start: day(3), end: day(8), progress: 0.1 },
    { id: 'qa', title: '测试', start: day(9), end: day(11) },
  ],
  links: [
    { id: 'l1', from: 'ui', to: 'fe' },
    { id: 'l2', from: 'fe', to: 'qa' },
  ],
})
const gantt = useTemplateRef<InstanceType<typeof DouGantt>>('gantt')
let count = 0

// 任务上多一项“标记完成”，空白处多一项“在这里添加里程碑”
function contextMenu(target: GanttMenuTarget): ContextMenuItem[] {
  if (target.kind === 'task') {
    const { task } = target
    return [
      {
        key: 'done',
        label: '标记完成',
        icon: CheckIcon,
        disabled: task.progress === 1,
        run: () => gantt.value?.transact((tr) => tr.updateTask(task.id, { progress: 1 })),
      },
    ]
  }
  if (target.kind === 'canvas') {
    return [
      {
        key: 'milestone',
        label: '在这里添加里程碑',
        icon: FlagIcon,
        run: () =>
          gantt.value?.transact((tr) =>
            tr.addTask({
              id: `m${++count}`,
              title: `里程碑 ${count}`,
              type: 'milestone',
              start: formatTime(target.time, true),
            }),
          ),
      },
    ]
  }
  return []
}
</script>

<template>
  <DouGantt ref="gantt" v-model="plan" :context-menu="contextMenu" />
</template>
