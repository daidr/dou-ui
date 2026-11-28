# 标记线与基线

标记线标出时间轴上的重要日期，基线标出任务原来计划的位置。

## 标记线与行内事件点

`markers` 默认在时间轴上画贯穿全高的竖向标记线，比如发布日、代码冻结。

<DocDemo src="gantt/markers" column />

- `date` 是位置，支持 `GanttTime`（日期、时刻字符串或 Unix 毫秒时间戳）；只写日期时在当天开始处；
- `label` 显示在表头（行内事件点上用作无障碍名称与悬停提示）；
- `tone` 可选 `neutral`、`primary`、`success`、`warning`、`danger`。

两个竖向标记线离得太近时，左边的标签会截短或只留下线，鼠标悬停可以看到完整文字。

给标记指定 `endDate` 后，它会渲染为跨越 `[date, endDate]` 的半透明时间区间底纹（如离开回看区间、封板窗口），并在 `DouGantt` 导出 SVG 时同步绘制；同时指定 `task` 或 `resource` 时，底纹仅限定在对应行或泳道内。

给标记仅指定 `task`（在 `DouGantt` 中）或 `resource`（在 `DouScheduler` 中）而不设 `endDate` 时，它会渲染为对应行或泳道内的离散事件点。点击事件点会触发 `markerClick(marker, event)`，通过 `#marker="{ marker }"` 与 `#marker-tooltip="{ marker }"` 可以自定义圆点样式和 `DouTooltip` 悬浮提示。完整演示见[实时监控时间线](./timeline#实时监控时间线)。

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

| 名称       | 说明                                                                                   | 类型                                                           | 默认值      |
| ---------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ----------- |
| `id`       | 可选唯一标识，便于事件回调与列表更新复用                                               | `string`                                                       | —           |
| `date`     | 位置或区间开始时间，支持日期、时刻字符串（含秒/毫秒/时区）或 Unix 毫秒时间戳           | `GanttTime`                                                    | —           |
| `endDate`  | 可选结束时间；传入时渲染为 `[date, endDate]` 半透明区间底纹                            | `GanttTime`                                                    | —           |
| `label`    | 竖向标记线与全局区间底纹显示在表头；行内/泳道事件点用作悬停提示和无障碍名称            | `string`                                                       | —           |
| `tone`     | 颜色                                                                                   | `'neutral' \| 'primary' \| 'success' \| 'warning' \| 'danger'` | `'neutral'` |
| `task`     | 归属的任务 id；在 `DouGantt` 中渲染为行内离散事件点（配合 `endDate` 时为行内底纹）     | `string`                                                       | —           |
| `resource` | 归属的资源 id；在 `DouScheduler` 中渲染为泳道离散事件点（配合 `endDate` 时为泳道底纹） | `string`                                                       | —           |
| `class`    | 附加在标记线、事件点或区间底纹元素上的自定义类名                                       | `GanttClassValue`                                              | —           |
| `data`     | 附加业务数据，可在 `#marker` / `#marker-tooltip` 插槽或 `markerClick` 中读取           | `Record<string, unknown>`                                      | —           |

### GanttBaselineItem

| 名称    | 说明                       | 类型                     |
| ------- | -------------------------- | ------------------------ |
| `id`    | 任务的 id                  | `string`                 |
| `start` | 计划的开始时间             | `GanttTime`              |
| `end`   | 计划的结束时间，里程碑没有 | `GanttTime \| undefined` |
