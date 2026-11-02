# 标记线与基线

标记线标出时间轴上的重要日期，基线标出任务原来计划的位置。

## 标记线

`markers` 在时间轴上画竖向的标记线，比如发布日、代码冻结。

<DocDemo src="gantt/markers" column />

- `date` 是位置，只写日期时在当天开始处；
- `label` 显示在表头；
- `tone` 可选 `neutral`、`primary`、`success`、`warning`、`danger`。

两个标记离得太近时，左边的标签会截短或只留下线，鼠标悬停可以看到完整文字。

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

| 名称    | 说明                                                  | 类型                                                           | 默认值      |
| ------- | ----------------------------------------------------- | -------------------------------------------------------------- | ----------- |
| `date`  | 位置，`YYYY-MM-DD`（当天开始处）或 `YYYY-MM-DD HH:mm` | `string`                                                       | —           |
| `label` | 显示在表头的文字                                      | `string`                                                       | —           |
| `tone`  | 颜色                                                  | `'neutral' \| 'primary' \| 'success' \| 'warning' \| 'danger'` | `'neutral'` |

### GanttBaselineItem

| 名称    | 说明                       | 类型     |
| ------- | -------------------------- | -------- |
| `id`    | 任务的 id                  | `string` |
| `start` | 计划的开始时间             | `string` |
| `end`   | 计划的结束时间，里程碑没有 | `string` |
