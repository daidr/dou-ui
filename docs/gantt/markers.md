# 标记线与基线

标记线标出时间轴上的重要日期，基线标出任务原来计划的位置。

## 标记线与行内事件点

`markers` 默认在时间轴上画贯穿全高的竖向标记线，比如发布日、代码冻结。

<DocDemo src="gantt/markers" column />

- `date` 是位置，支持 `GanttTime`（日期、时刻字符串或 Unix 毫秒时间戳）；只写日期时在当天开始处；
- `label` 显示在表头（行内事件点上用作无障碍名称与悬停提示）；
- `tone` 可选 `neutral`、`primary`、`success`、`warning`、`danger`。

两个竖向标记线离得太近时，左边的标签会截短或只留下线，鼠标悬停可以看到完整文字。

给标记指定 `task`（在 `DouGantt` 中）或 `resource`（在 `DouScheduler` 中）后，它会渲染为对应行或泳道内的离散事件点，而不是贯穿全高的竖线。点击事件点会触发 `markerClick(marker, event)`，通过 `#marker="{ marker }"` 插槽可以自定义圆点或图标样式。完整演示见[实时监控时间线](./timeline#实时监控时间线)。

## 基线

基线是某一时刻保存下来的计划日期。传入 `baseline` 后，每个任务条下方会画一条细的灰线，标出计划中的位置，可以看出哪些任务比计划提前或推迟。读屏时也会读出比计划晚或早了多久。

<DocDemo src="gantt/baseline" column />

`takeBaseline(tasks)` 把当前的日期保存成基线，汇总任务按子任务覆盖的范围保存：

```ts
import { takeBaseline, type GanttBaselineItem } from '@dou-ui/gantt'

const baseline = ref<GanttBaselineItem[]>()
baseline.value = takeBaseline(plan.value.tasks) // [{ id, start, end }, …]
```

基线是普通的数组，和任务一起存到服务端即可，需要对比时再传回来。可以保存多份，切换 `baseline` 查看不同时期的计划。

## API

### GanttMarker

| 名称       | 说明                                                                | 类型                                                           | 默认值      |
| ---------- | ------------------------------------------------------------------- | -------------------------------------------------------------- | ----------- |
| `id`       | 可选唯一标识，便于事件回调与列表更新复用                            | `string`                                                       | —           |
| `date`     | 位置，支持日期、时刻字符串（含秒/毫秒/时区）或 Unix 毫秒时间戳      | `GanttTime`                                                    | —           |
| `label`    | 竖向标记线显示在表头；行内/泳道事件点用作悬停提示和无障碍名称       | `string`                                                       | —           |
| `tone`     | 颜色                                                                | `'neutral' \| 'primary' \| 'success' \| 'warning' \| 'danger'` | `'neutral'` |
| `task`     | 归属的任务 id；在 `DouGantt` 中设置后渲染在该任务行内的离散事件点   | `string`                                                       | —           |
| `resource` | 归属的资源 id；在 `DouScheduler` 中设置后渲染在该泳道内的离散事件点 | `string`                                                       | —           |
| `data`     | 附加业务数据，可在 `#marker` 插槽或 `markerClick` 中读取            | `Record<string, unknown>`                                      | —           |

### GanttBaselineItem

| 名称    | 说明                       | 类型                     |
| ------- | -------------------------- | ------------------------ |
| `id`    | 任务的 id                  | `string`                 |
| `start` | 计划的开始时间             | `GanttTime`              |
| `end`   | 计划的结束时间，里程碑没有 | `GanttTime \| undefined` |
