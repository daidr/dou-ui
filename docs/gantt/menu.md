# 右键菜单

在任务条、表格的行、依赖线或时间轴空白处点右键，或者按菜单键（`Shift` + `F10`），会打开菜单。触屏上按住任务条或行片刻后松手也会打开。

## 内置菜单项

- 任务上：重命名、在下方添加任务、添加子任务、缩进、取消缩进、删除任务；
- 依赖线上：删除依赖；
- 时间轴空白处（包括最后一行下方）：添加任务，新任务从点击的那天开始。

`menu` 设为 `false` 时不显示内置项。

## 添加菜单项

`contextMenu` 返回自己的菜单项，写法同 [ContextMenu](/components/context-menu) 的 `items`。下面的例子在任务上加了“标记完成”，在时间轴空白处加了“在这里添加里程碑”：

<DocDemo src="gantt/menu" />

```vue
<script setup lang="ts">
import { DouGantt, type GanttMenuTarget } from '@dou-ui/gantt'
import { CheckIcon } from '@dou-ui/icons'
import type { ContextMenuItem } from 'dou-ui'
import { useTemplateRef } from 'vue'

const gantt = useTemplateRef<InstanceType<typeof DouGantt>>('gantt')

function contextMenu(target: GanttMenuTarget): ContextMenuItem[] {
  if (target.kind !== 'task') return []
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
</script>

<template>
  <DouGantt ref="gantt" v-model="plan" :context-menu="contextMenu" />
</template>
```

`target` 说明菜单是在哪里打开的：

- `kind` 是 `task`、`link` 或 `canvas`（时间轴空白处，包括最后一行下方）；
- `point` 是打开菜单的位置（时间轴坐标），`time` 是这个位置对应的时间（分钟），可以用来在点击的地方添加任务或里程碑；
- 从表格或键盘打开时，位置在任务的开始处。

## 写成扩展

只是加几项时用属性更直接，需要和其他功能一起复用时写成[扩展](./extensions)。扩展的 `contextMenu` 多一个参数 `ctx`：

```ts
import { defineGanttExtension, formatTime } from '@dou-ui/gantt'

// 在空白处右键的位置添加里程碑；time 是分钟数，用 formatTime 写成日期
const milestones = defineGanttExtension({
  name: 'milestones',
  contextMenu: (ctx, target) =>
    target.kind === 'canvas'
      ? [
          {
            key: 'milestone',
            label: '在这里添加里程碑',
            run: () =>
              ctx.transact((tr) =>
                tr.addTask({
                  id: crypto.randomUUID(),
                  title: '里程碑',
                  type: 'milestone',
                  start: formatTime(target.time, true),
                }),
              ),
          },
        ]
      : [],
})
```

菜单项的顺序是属性的项、扩展的项、内置项。

## 不打开菜单

`taskContextmenu`、`linkContextmenu` 事件先于菜单触发，调用 `event.preventDefault()` 就不打开菜单。

## API

### 相关 Props

| 名称          | 说明                     | 类型                                             | 默认值 |
| ------------- | ------------------------ | ------------------------------------------------ | ------ |
| `menu`        | 显示内置的菜单项         | `boolean`                                        | `true` |
| `contextMenu` | 自己的菜单项，排在最前面 | `(target: GanttMenuTarget) => ContextMenuItem[]` | —      |

### GanttMenuTarget

| 名称    | 说明                                | 类型                           |
| ------- | ----------------------------------- | ------------------------------ |
| `kind`  | 在哪里打开                          | `'task' \| 'link' \| 'canvas'` |
| `task`  | `kind` 为 `task` 时，打开菜单的任务 | `GanttTask`                    |
| `link`  | `kind` 为 `link` 时，打开菜单的依赖 | `GanttLink`                    |
| `point` | 打开菜单的位置，时间轴坐标          | `GanttPoint`（`{ x, y }`）     |
| `time`  | 这个位置对应的时间（分钟）          | `number`                       |
