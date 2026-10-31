# 资源排期

`DouScheduler` 按资源排列任务：每一行是一个人、一间会议室或一台设备，任务按 `resource` 字段放到对应的行。同一行里时间重叠的任务会自动分成多道，行高随之增加，可以直接看出谁在什么时候忙。

它和甘特图使用同一套任务数据、时间轴、工作日历和撤销记录，只是行的含义不同。

```ts
import { DouScheduler } from '@dou-ui/gantt/scheduler'
```

## 基础用法

用 `resources` 列出所有资源，任务的 `resource` 写资源的 `id`。资源有 `group` 时，同一组的资源排在一起，组名可以展开和收起。没有 `resource` 的任务放在最后的“未分配”一行。

<DocDemo src="gantt/scheduler" />

拖动任务可以改时间，拖到别的行就换了资源；拖动两端可以改起止时间。按住 Shift 或 Ctrl（macOS 上是 Command）可以多选，多选后一起拖动。手机上长按任务后再拖动，直接滑动是滚动。

## 负载

每行底部的细条表示这个资源有多忙：同时进行的任务越多颜色越深，超过 `capacity`（默认为 1）的时段用警告色，资源名旁边也会显示一个提示点。不需要时可以设置 `:load="false"` 关闭。

```ts
const resources = [{ id: 'xiaoman', title: '林小满', capacity: 2 }]
```

## 预约

在一行的空白处拖出一段时间，会触发 `range-select` 事件，参数是资源和这段时间。组件不会自己新建任务，在事件里按需要添加即可，例如会议室预约：

<DocDemo src="gantt/booking" />

```ts
function book(range: SchedulerRange) {
  tasks.value = [
    ...tasks.value,
    { id: createId(), title: '新预约', ...range, resource: range.resource ?? undefined },
  ]
}
```

时间按当前刻度吸附：小时刻度下按 15 分钟、30 分钟或 1 小时，天及以上的刻度按整天，整天的范围写成只有日期的字符串。

## 键盘

| 按键                                | 作用                                                                 |
| ----------------------------------- | -------------------------------------------------------------------- |
| 方向键                              | 在任务之间移动：左右是同一行的前后任务，上下是相邻行里时间最近的任务 |
| `Alt` + `←` / `→`                   | 把任务提前或推后一格                                                 |
| `Alt` + `↑` / `↓`                   | 把任务换到上一个或下一个资源                                         |
| `Enter` / `Space`                   | 选中当前任务                                                         |
| `Delete` / `Backspace`              | 删除选中的任务                                                       |
| `Mod` + `Z` / `Mod` + `Shift` + `Z` | 撤销 / 重做                                                          |
| `Esc`                               | 取消拖动，或清空选中                                                 |

## API

### Props

| 名称                | 说明                                | 类型                    | 默认值         |
| ------------------- | ----------------------------------- | ----------------------- | -------------- |
| `v-model:tasks`     | 任务，写法和甘特图相同              | `GanttTask[]`           | `[]`           |
| `v-model:selection` | 选中的任务 id                       | `string[]`              | `[]`           |
| `v-model:scale`     | 时间刻度                            | `GanttScale`            | 按内容自动缩放 |
| `resources`         | 资源，按顺序排成行                  | `GanttResource[]`       | —              |
| `calendar`          | 工作日历                            | `GanttCalendar`         | —              |
| `range`             | 固定时间轴的范围                    | `[string, string]`      | —              |
| `today`             | 显示当前时间线                      | `boolean`               | `true`         |
| `week-start`        | 一周的第一天                        | `0 \| 1`                | 跟随语言       |
| `markers`           | 标记线                              | `GanttMarker[]`         | —              |
| `table`             | 显示左侧的资源列表                  | `boolean`               | `true`         |
| `table-width`       | 资源列表的宽度                      | `number`                | `200`          |
| `row-height`        | 只有一道时的行高，每多一道增加 28px | `number`                | `36`           |
| `load`              | 显示负载条                          | `boolean`               | `true`         |
| `readonly`          | 只读                                | `boolean`               | `false`        |
| `aria-label`        | 读屏名称                            | `string`                | `'资源排期'`   |
| `messages`          | 覆盖文案                            | `GanttMessagesOverride` | —              |

```ts
interface GanttResource {
  id: string
  title: string
  /** 同组的资源排在一起 */
  group?: string
  /** 同时能承担的任务数，默认为 1 */
  capacity?: number
  data?: Record<string, unknown>
}
```

### 事件

| 名称            | 说明                           | 参数                                   |
| --------------- | ------------------------------ | -------------------------------------- |
| `transaction`   | 每次修改后触发，包括撤销和重做 | `(tr: GanttTransaction)`               |
| `task-click`    | 点击任务                       | `(task: GanttTask, event: MouseEvent)` |
| `task-dblclick` | 双击任务                       | `(task: GanttTask, event: MouseEvent)` |
| `range-select`  | 在空白处拖出一段时间           | `(range: SchedulerRange)`              |

```ts
interface SchedulerRange {
  /** 资源 id，在“未分配”一行时为 null */
  resource: string | null
  start: string
  end: string
}
```

### 插槽

| 名称       | 说明             | 参数           |
| ---------- | ---------------- | -------------- |
| `bar`      | 任务条里的内容   | `{ task }`     |
| `resource` | 资源列表里的一项 | `{ resource }` |

### 方法

| 名称                                                          | 说明                                   |
| ------------------------------------------------------------- | -------------------------------------- |
| `transact(fn, meta?)`                                         | 把修改作为一次事务提交，撤销时一起撤销 |
| `undo()` / `redo()`                                           | 撤销 / 重做                            |
| `fit()`                                                       | 缩放到所有任务都能看到                 |
| `scrollToDate(date)` / `scrollToToday()` / `scrollToTask(id)` | 滚动到某个时间或任务                   |
| `focusTask(id)`                                               | 让某个任务获得焦点                     |
| `zoomIn()` / `zoomOut()`                                      | 放大 / 缩小时间轴                      |

### 函数

| 名称              | 说明                               | 类型                                                  |
| ----------------- | ---------------------------------- | ----------------------------------------------------- |
| `packLanes`       | 把重叠的任务分到不同的道，返回道数 | `(items: { span, lane }[]) => number`                 |
| `loadSegments`    | 计算每段时间同时进行的任务数       | `(spans: Iterable<TaskSpan>) => LoadSegment[]`        |
| `groupByResource` | 按资源分组并分道                   | `(tasks, resources) => Map<string, { items, lanes }>` |
