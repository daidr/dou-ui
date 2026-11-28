# 资源排期

`DouScheduler` 按资源排列任务：每一行是一个人、一间会议室或一台设备，任务按 `resource` 字段放到对应的行。同一行里时间重叠的任务会自动分成多道，行高随之增加，可以直接看出谁在什么时候忙。

它和甘特图使用同一套任务数据、时间轴、工作日历和撤销记录，只是行的含义不同。

```ts
import { DouScheduler } from '@dou-ui/gantt/scheduler'
```

## 基础用法

用 `resources` 列出所有资源，任务的 `resource` 写资源的 `id`。资源有 `group` 时，同一组的资源排在一起，组名可以展开和收起。没有 `resource` 的任务放在最后的“未分配”一行。

`v-model` 和甘特图是同一种数据 `{ version: 1, tasks, links }`，这样同一份排期可以同时交给甘特图和资源视图。资源视图不用 `links`，只用它时写 `links: []` 即可；缺少 `links` 也能正常显示，写回时会补上空数组。

<DocDemo src="gantt/scheduler" />

拖动任务可以改时间，拖到别的行就换了资源；拖动两端可以改起止时间。按住 Shift 或 Ctrl（macOS 上是 Command）可以多选，多选后一起拖动。手机上长按任务后再拖动，直接滑动是滚动。

## 负载

每行底部的细条表示这个资源有多忙：同时进行的任务越多颜色越深，超过 `capacity`（默认为 1）的时段用警告色，资源名旁边也会显示一个提示点。不需要时可以设置 `:load="false"` 关闭。

```ts
const resources = [{ id: 'xiaoman', title: '林小满', capacity: 2 }]
```

## 预约

在一行的空白处拖出一段时间，会触发 `create` 事件，参数是资源和这段时间。组件不会自己新建任务，在事件里按需要添加即可。用 `transact` 添加时，新任务和拖动一样计入撤销记录，读屏也会播报：

<DocDemo src="gantt/booking" />

```ts
const scheduler = useTemplateRef('scheduler')

function book(range: SchedulerRange) {
  scheduler.value?.transact((tr) =>
    tr.addTask({ id: crypto.randomUUID(), title: '新预约', ...range }),
  )
}
```

时间按当前刻度吸附：小时刻度下按 15 分钟、30 分钟或 1 小时，天及以上的刻度按整天，整天的范围写成只有日期的字符串。

## 限制移动

`canMove` 在任务被拖动、改时长、换资源或用键盘移动之前调用，参数里的 `resource` 是任务将要去的资源。返回 `true` 表示允许；返回其他值会拒绝这次修改，返回字符串时会在拖动提示里显示原因。上面的会议室示例用它禁止同一间会议室的预约重叠：

```ts
import { findConflict, type SchedulerMove } from '@dou-ui/gantt/scheduler'

const canMove = (move: SchedulerMove) => !findConflict(plan.value.tasks, move) || '这段时间已有预约'
```

`findConflict(tasks, place)` 返回同一资源上和 `place` 时间重叠的第一个任务，没有时返回 `undefined`。`place` 的写法和 `SchedulerMove` 相同，`task` 是正在移动的任务，不会和自己冲突；首尾相接不算重叠，没有 `resource` 时不检查。新建预约前也可以用它检查，这时不传 `task`。

## 右键菜单

在任务上右键、手机上长按任务后松开，或者按菜单键（`Shift` + `F10`），会打开任务的菜单，内置一项“删除任务”。`contextMenu` 可以加上自己的菜单项，排在内置项前面；在一行的空白处右键时，参数是这一行的资源和鼠标下的时间，可以用来加“在此预约”之类的项。`:menu="false"` 关闭内置项。

```ts
import type { SchedulerMenuTarget } from '@dou-ui/gantt'
import type { ContextMenuItem } from 'dou-ui'

function contextMenu(target: SchedulerMenuTarget): ContextMenuItem[] {
  if (target.kind === 'task')
    return [{ key: 'edit', label: '编辑', run: () => openEditor(target.task) }]
  return []
}
```

排期视图没有任务表格，不能就地改名；需要编辑任务时，可以在 `taskDblclick` 或自己的菜单项里打开表单。

## 泳道交互与自定义渲染

- **泳道行选中与点击**：通过 `v-model:selectedResource` 控制高亮泳道（左侧列表行与右侧时间轴泳道同步套用 `.is-selected`），点击左侧列表或右侧泳道空白区会触发 `resourceClick(resource, event)`（已自动忽略交互子控件及拖拽平移后的松手点击）；`rowClass` 支持按行附加自定义类名，同时应用到左右两侧。
- **可控分组折叠与 `#group` 插槽**：`v-model:collapsedGroups` 可受控或默认指定折叠的分组名列表；`#group` 插槽接收 `{ group, title, resources, count, collapsed, toggle }`，用于自定义组头外观或操作。
- **任务条标签、内容与悬浮提示**：`barLabel` 控制任务名位置（`'auto' | 'inside' | 'outside' | 'none'`）；`#bar-content` 在任务条内部常驻渲染而不受 `barLabel` 影响；`#bar-tooltip` 与 `#marker-tooltip` 接入 `DouTooltip` 渲染自定义富提示并自动关闭原生 `title`，也可通过 `:native-title="false"` 单独关闭原生 `title`；任务自身的 `class` 会附加到任务条元素上。
- **顶部辅助轨道、画布图层与 `useScheduler()`**：`#rail` 与 `#rail-header` 在时间轴表头正下方渲染一条与时间轴及 `tableWidth` 同步的辅助轨道（默认高度 36px，可通过 `railHeight` 调整），适合绘制并发水位图或资源统计条；`#underlay` 与 `#overlay` 分别在任务条下方和上方提供与画布坐标系对齐的扩展图层，插槽参数和 `useScheduler()` 均提供 `viewport`、`xOf`、`timeAt`、`rowBox`、`barBox` 等几何信息。完整示例见[实时监控时间线](./timeline#实时监控时间线)。

## 键盘

| 按键                                | 作用                                                                 |
| ----------------------------------- | -------------------------------------------------------------------- |
| 方向键                              | 在任务之间移动：左右是同一行的前后任务，上下是相邻行里时间最近的任务 |
| `Alt` + `←` / `→`                   | 把任务提前或推后一格                                                 |
| `Alt` + `↑` / `↓`                   | 把任务换到上一个或下一个资源                                         |
| `Enter` / `Space`                   | 选中当前任务                                                         |
| 菜单键 / `Shift` + `F10`            | 打开当前任务的菜单                                                   |
| `Delete` / `Backspace`              | 删除选中的任务                                                       |
| `Mod` + `Z` / `Mod` + `Shift` + `Z` | 撤销 / 重做                                                          |
| `Esc`                               | 取消拖动，或清空选中                                                 |

## 主题

排期视图沿用甘特图的样式和 CSS 变量，根元素的类名是 `dou-gantt is-scheduler`。只想改排期视图时，用 `.dou-gantt.is-scheduler` 作为选择器。

## API

### Scheduler Props

| 名称                       | 说明                                                                                                        | 类型                                                             | 默认值                                 |
| -------------------------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | -------------------------------------- |
| `v-model`                  | 排期，和甘特图的是同一种数据，只读写其中的 `tasks`                                                          | `GanttDocument`                                                  | `{ version: 1, tasks: [], links: [] }` |
| `v-model:selection`        | 选中的任务 id                                                                                               | `string[]`                                                       | `[]`                                   |
| `v-model:scale`            | 时间刻度                                                                                                    | `GanttScale`                                                     | 按内容自动缩放                         |
| `v-model:follow`           | 跟随当前时间到视口右侧，横向滚动或拖拽平移时自动关闭，见[实时监控时间线](./timeline#实时监控时间线)         | `boolean`                                                        | `false`                                |
| `v-model:tableWidth`       | 资源列表的宽度（px），拖动或键盘调整分隔线时双向同步                                                        | `number`                                                         | `200`                                  |
| `v-model:selectedResource` | 当前选中的资源 id（`''` 表示未分配行，点击泳道行时同步更新）                                                | `string \| null`                                                 | —                                      |
| `v-model:collapsedGroups`  | 当前收起的分组名称列表，支持默认折叠与受控同步                                                              | `string[]`                                                       | `[]`                                   |
| `resources`                | 资源，按顺序排成行                                                                                          | `SchedulerResource[]`                                            | —                                      |
| `calendar`                 | 工作日历；设为 `false` 关闭非工作时段底纹，按 24/7 连续时间计算                                             | `GanttCalendar \| false`                                         | —                                      |
| `range`                    | 固定时间轴的范围；不设时两端随滚动延伸                                                                      | `[GanttTime, GanttTime]`                                         | —                                      |
| `today`                    | 显示当前时间线                                                                                              | `boolean`                                                        | `true`                                 |
| `now`                      | 外部校准的当前时间（如服务端时间戳），驱动当前时间线与跟随锚点；暂停更新即可冻结推进而不关闭 `follow`       | `GanttTime`                                                      | 本地时钟                               |
| `weekStart`                | 一周的第一天                                                                                                | `0 \| 1`                                                         | 跟随语言                               |
| `markers`                  | 标记线、区间底纹（设置 `endDate`）与泳道内离散事件点（设置 `resource`）                                     | `GanttMarker[]`                                                  | —                                      |
| `table`                    | 显示左侧的资源列表                                                                                          | `boolean`                                                        | `true`                                 |
| `rowHeight`                | 只有一道时的行高，每多一道增加 28px                                                                         | `number`                                                         | `36`                                   |
| `railHeight`               | 顶部辅助轨道（`#rail` / `#rail-header`）的高度（px）                                                        | `number`                                                         | `36`                                   |
| `barLabel`                 | 任务名放在哪里：`auto` 放得下时在条内，否则在条旁                                                           | `'auto' \| 'inside' \| 'outside' \| 'none'`                      | `'auto'`                               |
| `nativeTitle`              | 是否在任务条与事件点上输出浏览器原生 `title`；提供 `#bar-tooltip` / `#marker-tooltip` 时自动关闭            | `boolean`                                                        | `true`                                 |
| `rowClass`                 | 附加到左侧列表行和右侧泳道行的自定义类名                                                                    | `string \| ((row: SchedulerRowInfo) => GanttClassValue)`         | —                                      |
| `load`                     | 显示负载条                                                                                                  | `boolean`                                                        | `true`                                 |
| `readonly`                 | 只读                                                                                                        | `boolean`                                                        | `false`                                |
| `bordered`                 | 外框和圆角；关闭后去掉外框和圆角，用于放进已有边框的容器，见[去掉外框](/guide/theming#去掉外框与调整内边距) | `boolean`                                                        | `true`                                 |
| `canMove`                  | 移动前的检查，见上文                                                                                        | `(move: SchedulerMove, doc: GanttDocument) => boolean \| string` | —                                      |
| `menu`                     | 菜单里显示内置的“删除任务”                                                                                  | `boolean`                                                        | `true`                                 |
| `contextMenu`              | 自己的菜单项                                                                                                | `(target: SchedulerMenuTarget) => ContextMenuItem[]`             | —                                      |
| `ariaLabel`                | 读屏名称                                                                                                    | `string`                                                         | `'资源排期'`                           |
| `messages`                 | 覆盖文案，如表头 `{ scheduler: { resource: '会议室' } }`                                                    | `GanttMessagesOverride`                                          | —                                      |

```ts
interface SchedulerResource {
  id: string
  title: string
  /** 同组的资源排在一起 */
  group?: string
  /** 同时能承担的任务数，默认为 1 */
  capacity?: number
  data?: Record<string, unknown>
}
```

### CSS 变量

| 名称                 | 说明                                                                    | 默认值                    |
| -------------------- | ----------------------------------------------------------------------- | ------------------------- |
| `--dou-gantt-border` | 外框颜色，和甘特图共用；只改排期视图时设在 `.dou-gantt.is-scheduler` 上 | `var(--dou-color-border)` |

### Scheduler Events

| 名称              | 说明                                                        | 参数                                           |
| ----------------- | ----------------------------------------------------------- | ---------------------------------------------- |
| `viewportChange`  | 可见时间范围、缩放比例或视口几何变化时触发                  | `(viewport: GanttViewport)`                    |
| `transaction`     | 每次修改后触发，包括撤销和重做                              | `(tr: GanttTransaction)`                       |
| `taskClick`       | 点击任务                                                    | `(task: GanttTask, event: MouseEvent)`         |
| `taskDblclick`    | 双击任务                                                    | `(task: GanttTask, event: MouseEvent)`         |
| `taskContextmenu` | 在任务上打开菜单前触发，`event.preventDefault()` 可以不打开 | `(task: GanttTask, event: MouseEvent)`         |
| `resourceClick`   | 点击左侧资源行或右侧泳道空白区                              | `(resource: SchedulerResource \| null, event)` |
| `markerClick`     | 点击泳道内离散事件标记点                                    | `(marker: GanttMarker, event: MouseEvent)`     |
| `create`          | 在空白处拖出一段时间                                        | `(range: SchedulerRange)`                      |

```ts
interface SchedulerRange {
  /** 资源 id，在“未分配”一行时为 undefined */
  resource?: string
  start: string
  end: string
}

interface SchedulerMove {
  task: GanttTask
  start: GanttTime
  end?: GanttTime
  /** 要去的资源，“未分配”一行时为 undefined */
  resource?: string
}

type SchedulerMenuTarget =
  | { kind: 'task'; task: GanttTask; resource: SchedulerResource | null; time: number }
  | { kind: 'row'; resource: SchedulerResource | null; time: number }
```

### Scheduler Slots

| 名称             | 说明                                              | 参数                                                                 |
| ---------------- | ------------------------------------------------- | -------------------------------------------------------------------- |
| `bar`            | 任务条的标题内容（受 `barLabel` 控制）            | `{ task, resource, width, placement }`                               |
| `bar-content`    | 常驻渲染在任务条内部的内容，不受 `barLabel` 影响  | `{ task, resource, width, milestone }`                               |
| `bar-tooltip`    | 任务条悬浮提示（通过 `DouTooltip` 渲染）          | `{ task, resource }`                                                 |
| `resource`       | 资源列表里的一项                                  | `{ resource, count, overloaded, selected }`                          |
| `group`          | 分组头行自定义内容                                | `{ group, title, resources, count, collapsed, toggle }`              |
| `marker`         | 泳道内离散事件标记点的内容                        | `{ marker }`                                                         |
| `marker-tooltip` | 泳道事件标记点悬浮提示（通过 `DouTooltip` 渲染）  | `{ marker }`                                                         |
| `rail-header`    | 顶部辅助轨道的左侧列头，宽度与 `tableWidth` 同步  | `{ width, height }`                                                  |
| `rail`           | 固定在时间轴表头正下方的顶部辅助轨道              | `SchedulerRailScope`（`viewport`、`xOf`、`timeAt`、`totalWidth` 等） |
| `underlay`       | 渲染在任务条下方的画布扩展图层                    | `SchedulerCanvasScope`（含 `xOf`、`timeAt`、`rowBox`、`barBox` 等）  |
| `overlay`        | 渲染在任务条上方的画布扩展图层                    | `SchedulerCanvasScope`（含 `xOf`、`timeAt`、`rowBox`、`barBox` 等）  |
| `default`        | 渲染在根容器内的附加内容，可调用 `useScheduler()` | —                                                                    |

### Scheduler Exposes

| 名称                                                          | 说明                                                        |
| ------------------------------------------------------------- | ----------------------------------------------------------- |
| `transact(fn, meta?)`                                         | 把修改作为一次事务提交，撤销时一起撤销                      |
| `undo()` / `redo()`                                           | 撤销 / 重做                                                 |
| `fit(range?)`                                                 | 缩放到所有任务都能看到，或传入 `[start, end]` 适配时间窗    |
| `scrollToDate(date)` / `scrollToToday()` / `scrollToTask(id)` | 滚动到某个时间或任务                                        |
| `focusTask(id)`                                               | 让某个任务获得焦点                                          |
| `zoomIn()` / `zoomOut()`                                      | 放大 / 缩小时间轴                                           |
| `getViewport()`                                               | 返回当前可见时间范围与时间轴几何（`GanttViewport`）         |
| `xOf(time)`                                                   | 将日期或时间戳换算为画布水平坐标（px），无效时间返回 `null` |
| `timeAt(x)`                                                   | 将画布水平坐标（px）换算为 Unix 毫秒时间戳                  |
| `rowBox(resourceId)`                                          | 返回已展开资源行的纵向几何信息，隐藏或不存在时返回 `null`   |
| `barBox(taskId)`                                              | 返回任务条在画布中的几何信息，未排期或不可见时返回 `null`   |

资源排期目前没有甘特图的 `exportSVG`、`exportPNG`、`toCSV` 和 `print`，需要导出时可以把 `tasks` 按资源整理后自己生成。

### 函数与上下文

| 名称              | 说明                                                 | 类型                                                       |
| ----------------- | ---------------------------------------------------- | ---------------------------------------------------------- |
| `useScheduler`    | 在插槽或子组件内读取当前 `DouScheduler` 上下文与坐标 | `() => SchedulerContext`                                   |
| `packLanes`       | 把重叠的任务分到不同的道，返回道数                   | `(items: { span, lane }[]) => number`                      |
| `loadSegments`    | 计算每段时间同时进行的任务数                         | `(spans: Iterable<TaskSpan>) => SchedulerLoadSegment[]`    |
| `groupByResource` | 按资源分组并分道                                     | `(tasks, resources) => Map<string, { items, lanes }>`      |
| `findConflict`    | 同一资源上时间重叠的第一个任务                       | `(tasks, place: SchedulerPlace) => GanttTask \| undefined` |
