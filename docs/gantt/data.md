# 文档数据

甘特图的数据是一份普通的 JSON，用 `v-model` 绑定，可以直接存储和传输。任务和依赖是两个扁平数组，层级用任务的 `parent` 表示，不嵌套，这样增删改都只动一条记录。

```ts
interface GanttDocument {
  version: 1 // 数据格式的版本
  tasks: GanttTask[]
  links: GanttLink[]
}
```

资源视图 `DouScheduler` 用同一份数据，它只读写 `tasks`，`links` 原样保留。

## 任务

```ts
interface GanttTask {
  id: string
  title: string
  parent?: string // 父任务的 id
  order?: string // 同级排序键，按字符串比较
  type?: 'task' | 'milestone'
  start?: string // 'YYYY-MM-DD' 或 'YYYY-MM-DD HH:mm'
  end?: string
  progress?: number // 0–1
  tone?: 'neutral' | 'primary' | 'success' | 'warning' | 'danger'
  collapsed?: boolean // 收起子任务
  locked?: boolean // 不能拖动和调整
  data?: Record<string, unknown> // 你自己的字段，可以显示成表格的列
}
```

### 时间

时间精确到分钟，有两种写法：

- 只写日期 `2026-03-05`：按整天算。`end` 是最后一天，包含当天，`start: '2026-03-02', end: '2026-03-06'` 是五天。
- 写到分钟 `2026-03-05 14:00`：`end` 是结束的那一刻，`start: '2026-03-05 14:00', end: '2026-03-05 16:30'` 是两个半小时。

两种写法可以混用，但要注意 `end` 的含义不同：`end: '2026-03-05'` 包含 3 月 5 日这一整天，而 `end: '2026-03-05 00:00'` 是 3 月 5 日零点，也就是 3 月 4 日结束，两者相差一天。

这套写法与 [CalendarView](/components/calendar-view) 的日程相同，同一份数据可以在两个组件之间直接使用。唯一的差别在 `start` 只写日期、`end` 写到分钟的混写：甘特图从 `start` 当天 0 点算到 `end` 的时刻，日历视图则把它当作全天日程，显示到 `end` 那一天。

带秒的写法（`2026-03-05 14:00:00`，DatePicker 开启秒时的值）也能读，秒会被忽略。其他写法（如 `2026-3-5`、`2026/03/05`）读不出来，任务会当作未排期；开发环境下控制台会提示是哪个任务的哪个字段。

时间按字面意思理解，不涉及时区：`09:00` 在任何时区都显示在 9 点的位置。

没有 `end` 时任务默认一天（只写日期时）或一小时（写到分钟时）。没有 `start` 的任务是未排期的，表格里照常显示，时间轴上不画任务条。

需要自己比较时间时，`spanOf(task)` 把任务换算成 `{ start, end, dateOnly }`，`start` 和 `end` 是分钟数，`end` 不包含在内（只写日期时是最后一天的次日零点），未排期的任务返回 `null`。`parseTime(text)` 读出 `{ at, dateOnly }`（读不出时是 `null`），`formatTime(minutes, dateOnly?)` 把分钟数写回字符串。

```ts
import { formatTime, spanOf } from '@dou-ui/gantt'

const a = spanOf(taskA)
const b = spanOf(taskB)
const overlap = a && b && a.start < b.end && b.start < a.end
if (a) formatTime(a.end) // '2026-03-07 00:00'
```

### 汇总任务和里程碑

有子任务的任务是汇总任务。它的起止时间是子任务覆盖的范围，进度是子任务按时长加权的平均值，自己的 `start`、`end`、`progress` 不会被读取。点击表格里的箭头收起或展开子任务，结果写回任务的 `collapsed`。

`type: 'milestone'` 是里程碑，只读 `start`，画成一个菱形。只写日期的里程碑落在那一天的正中。

### 顺序

同级任务默认按数组顺序显示。给任务设置 `order` 后按 `order` 的字符串大小排序，没有 `order` 的任务排在数组中它前一个任务之后。多人同时编辑时，用 `order` 插入任务不会冲突。

## 依赖

```ts
interface GanttLink {
  id: string
  from: string // 前置任务
  to: string // 后续任务
  type?: 'fs' | 'ss' | 'ff' | 'sf'
  lag?: number | string // 间隔，可以为负
}
```

| `type`       | 含义                             | 连线                        |
| ------------ | -------------------------------- | --------------------------- |
| `fs`（默认） | 前置任务完成后，后续任务才能开始 | 前置的结束端 → 后续的开始端 |
| `ss`         | 前置任务开始后，后续任务才能开始 | 开始端 → 开始端             |
| `ff`         | 前置任务完成后，后续任务才能完成 | 结束端 → 结束端             |
| `sf`         | 前置任务开始后，后续任务才能完成 | 开始端 → 结束端             |

`lag` 是两端之间的间隔，按工作时间计算：数字表示工作日，字符串可以带单位，`'2d'` 是两个工作日，`'4h'` 是四个工作小时，`'30m'` 是三十个工作分钟。手动排期时，依赖不满足的连线画成虚线；[自动排期](./scheduling)会按依赖推动后续任务。

连线从任务条的一端水平伸出，转直角进入另一个任务；两个任务挨得太近时，连线沿两行之间的缝隙绕回来。

## 列

`columns` 设置表格的列，写法和 [Table](/components/table) 的列一致：`title` 是表头文字，`value` 从任务里取值，`width`、`minWidth` 可以是数字（px）或任意 CSS 长度，`align` 是 `start`、`center` 或 `end`。

`key` 为 `title`、`start`、`end`、`duration`、`progress` 的是内置列，自带表头和格式；其他列没有 `value` 时读取任务 `data` 里与 `key` 同名的字段。不设 `width` 的列分掉剩下的宽度。

```ts
import type { GanttColumn } from '@dou-ui/gantt'

const columns: GanttColumn[] = [
  { key: 'title' },
  { key: 'owner', title: '负责人', width: 80, value: (task) => task.data?.owner },
  { key: 'start', width: 96 },
  { key: 'duration', width: 72, align: 'end' },
]
```

用 `cell` 插槽可以自定义单元格，插槽参数里有 `task`、`column` 和格式化好的 `text`。

不是只读时，双击单元格可以编辑。内置列默认可以编辑，设 `editable: false` 关闭；其他列设 `editable: true` 后可以编辑，写进任务 `data` 里与 `key` 同名的字段。

自定义列默认把输入的文字原样写入。要保存数字或其他类型时，用 `parse` 把文字转成要写入的值，返回 `undefined` 表示无法识别，输入框会保留并标红；用 `format` 决定值在单元格里显示成什么文字，输入框里显示的是值本身转成的文字。`input: 'number'` 让手机弹出数字键盘。

```ts
const columns: GanttColumn[] = [
  { key: 'title' },
  {
    key: 'budget',
    title: '预算',
    editable: true,
    input: 'number',
    align: 'end',
    parse: (text) => (text.trim() && Number.isFinite(Number(text)) ? Number(text) : undefined),
    format: (value) => (value == null ? '' : `¥${value}`),
  },
]
```

## 检查与迁移

文档里的 `version` 是数据格式的版本，目前是 `1`。保存或打开一份排期之前，可以先检查：

```ts
import { checkDocument, migrateDocument } from '@dou-ui/gantt'

const plan = migrateDocument(JSON.parse(saved))
const problems = checkDocument(plan, { canLink, extensions })
```

`checkDocument` 找出版本不对、任务或依赖缺少 `id` 或 `id` 重复、`parent` 指向不存在的任务或绕成一圈、读不懂的日期和 `lag`，以及有问题的依赖：指向不存在的任务、连到自己、连在汇总任务和它里面的任务之间、两个任务之间重复连接、绕成一圈。每一项带 `code`、`path`（如 `tasks[2].start`）和出问题的 `taskId` 或 `linkId`。传入和甘特图一样的 `canLink`、`extensions` 时，还会用它们的规则检查每条依赖，被拒绝的报 `refused-link`，`text` 是规则给出的理由；不传时只检查内置的规则。整份数据的形状不对（不是对象，或者列表不是数组）时只报 `shape`，先修好形状才能检查别的。`migrateDocument` 补全旧数据或手写数据缺少的部分（`version`、`tasks`、`links`），丢掉不是对象的任务和依赖；传入的不是对象（包括数组和 `null`），或者版本不认识时报错，以免把损坏的存档当成空排期再保存回去。还没有存档时用 `emptyDocument()` 新建。

`version` 的类型是字面量 `1`，在 TypeScript 里手写排期时给 `ref` 标上 `GanttDocument` 类型，或写成 `version: 1 as const`。`v-model` 的形状不对（缺少 `tasks`、`links` 或 `version`）时，甘特图把缺少的部分当成空的，并在开发环境下给出警告；写回的排期总是带 `version: 1`。

## 任务和依赖分开存储

很多后端把任务和依赖存成两张表。读取时分别取回，拼成一份排期；保存时从 `transaction` 事件的 `steps` 里取出改动，按 `type` 分给两张表，或者直接从 `v-model` 里分别取 `tasks` 和 `links`：

```ts
const [tasks, links] = await Promise.all([api.tasks(), api.links()])
const plan = ref<GanttDocument>({ version: 1, tasks, links })

function onTransaction(tr: GanttTransaction) {
  for (const step of tr.steps)
    if (step.type.endsWith('Task')) api.saveTask(step)
    else api.saveLink(step)
}
```
