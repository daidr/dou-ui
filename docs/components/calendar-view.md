# CalendarView 日历视图

按月、周或日展示日程的日历。

和 [DatePicker](./date-picker) 里的 `DouCalendar` 不同，这里每个格子都有地方放内容，适合排班、日程、发布计划这类场景。

## 基础用法

`events` 是一组 `{ id, start, title, tone? }`，`start` 写成 `YYYY-MM-DD`。`end` 写最后一天，让一件事跨几天，跨天的标签首尾相连。每天最多列 `max-events`（默认 3）项，其余折成“还有 N 项”。点日子触发 `select` 并更新 `v-model`，点日程触发 `event-click`。

<DocDemo src="calendar-view/basic" column />

## 周视图与日视图

`view` 切换月、周、日三种视图，配合 `v-model:view` 使用；传入 `views` 时在导航旁显示切换按钮。周视图和日视图沿纵向时间轴排布：`start` 带时间（`YYYY-MM-DD HH:mm`）的日程按时段放置，`end` 是结束的时刻，不填时按一小时算；时间重叠的日程并排显示，过了零点的日程在每一天的列里各画一段。`start` 只写日期的是全天日程，放在顶部的“全天”一行。今天的列里有一条当前时间线。

`hours` 设置时间轴覆盖的时段，`scroll-time` 是打开时滚动到的时间。点击时间轴上的空白处触发 `time-click`，参数是取整到半小时的 `YYYY-MM-DD HH:mm`，可以直接作为新日程的 `start`。

<DocDemo src="calendar-view/week" column />

## 拖动编辑

设置 `editable` 后可以直接在日历上修改日程，改动通过 `v-model:events` 写回：

- 拖动日程改时间。周视图和日视图里可以上下拖改时刻、左右拖到别的日子；月视图和“全天”一行里按整天移动，带时间的日程保留原来的时刻。跨天的日程拖动任何一段都是整体移动。
- 拖动带时间的日程的下边缘改结束时间；全天日程在最后一天的右边缘拖动，改最后一天。
- 在时间轴的空白处拖出一段时间，或者在月视图、“全天”一行里拖过几天，触发 `create`，参数 `{ start, end }` 的写法和日程一样，可以直接展开成一项新日程，也可以先弹窗让用户填标题。组件不会自己添加日程。
- 选中日程后按 <DouKbd>Delete</DouKbd>，或者在右键菜单里选“删除日程”，删除这一项。

时间轴上的拖动按 `snap` 分钟对齐，默认 15 分钟。拖动时日程跟着指针移动，松开后才写回；拖到时间轴的上下边缘会自动滚动，拖动中按 <DouKbd>Esc</DouKbd> 取消。没有拖动的点击仍然触发 `event-click`、`time-click` 和 `select`。触屏上按住日程片刻再拖动，直接滑动是滚动页面；在空白处按住片刻再拖动则是新建。

<DocDemo src="calendar-view/editing" column />

每次修改先写 `v-model:events`，再触发一次 `change`，参数里的 `kind` 是 `move`、`resize` 或 `remove`，`event` 是修改后的日程，`previous` 是修改前的。只需要把整份列表存起来时用 `v-model:events` 就够了；要逐项调用接口，或者日程是由别的数据算出来的（例如展开后的重复日程），就监听 `change` 自己更新，这时 `events` 只用 `:events` 传入。

移动后的日程保留原来的写法：只写日期的仍然只写日期；原来没有 `end` 的日程移动后也不加 `end`，调整时长后才写上。

### 锁定与限制

`locked: true` 的日程不能拖动、调整或删除。`disabled-date` 返回 `true` 的日子不能放日程，也不能在上面新建。

`can-move` 在写入之前检查，拖动、新建和键盘操作都会经过它。参数 `{ kind, event, start, end }` 里，`kind` 是 `move`、`resize` 或 `create`，新建时 `event` 是 `null`；`start`、`end` 是将要写入的值，`end` 总会给出，原来没写 `end` 的日程按默认的一小时算。返回 `true` 允许，返回字符串则拒绝并作为提示，其他返回值按“不能移到这里”拒绝。拖动时被拒绝的日程显示红色边框和提示，松开后不会写入。上面的示例只允许在 8:00 到 20:00 之间排日程，“全员大会”是锁定的。

```ts
const canMove = ({ start }: CalendarMove) => start >= today || '不能排在今天之前'
```

### 右键菜单

在日程、日子或时间轴空白处点右键，按菜单键（<DouKbd>Shift</DouKbd> + <DouKbd>F10</DouKbd>），或者触屏上按住片刻后松手，会打开菜单。设置 `editable` 时日程的菜单里有一项内置的“删除日程”，`:menu="false"` 不显示它。

`context-menu` 返回自己的菜单项，排在内置项前面。参数 `target.kind` 是 `event`（带 `event`）、`day`（月视图或“全天”一行里的日子，带 `date`）或 `time`（时间轴上的空白处，带按 `snap` 向下取整的 `start`）。不设置 `editable` 也可以有自己的菜单项。菜单为空时保留浏览器自己的菜单。`event-contextmenu` 在日程的菜单打开前触发，调用 `event.preventDefault()` 就不打开。

```ts
const contextMenu = (target: CalendarMenuTarget): CalendarMenuItem[] =>
  target.kind === 'event'
    ? [{ key: 'details', label: '查看详情', icon: FileTextIcon, run: () => open(target.event.id) }]
    : []
```

## 时区

日程的 `start`、`end` 是不带时区的“墙上时间”，组件按字面理解，不做任何换算：`'2026-10-28 09:00'` 在哪里打开都画在 9 点。拖动也只改这两个字符串，一天总是 24 小时，不受夏令时影响。今天的高亮和当前时间线按浏览器所在的时区。

服务端存的是带时区的时间（例如 ISO 字符串或时间戳）时，先换成看日历的人所在时区的墙上时间再传进来，写回时再换回去。跨时区的团队可以各自按自己的时区展示同一份数据：

```ts
// 把时间戳换成某个时区的 YYYY-MM-DD HH:mm
const wall = (ms: number, timeZone: string) =>
  new Intl.DateTimeFormat('sv-SE', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(ms)

wall(Date.parse('2026-10-28T01:00:00Z'), 'Asia/Shanghai') // '2026-10-28 09:00'
```

## 自定义格子

`cell` 插槽替换日期下面的内容，参数里有 `date`、`day`、`outside`、`today`、`selected`、`disabled` 和当天的 `events`。下面按星期几画一张排班表，周末不可选：

<DocDemo src="calendar-view/custom-cell" column />

格子的最小高度来自 CSS 变量 `--dou-calendar-view-day-height`（默认 112px）。`extra` 插槽放在右上角导航按钮的前面，适合放视图切换。

## API

### CalendarView Props

| 名称                    | 说明                                              | 类型                                                 | 默认值       |
| ----------------------- | ------------------------------------------------- | ---------------------------------------------------- | ------------ |
| `modelValue`（v-model） | 选中的日子，`YYYY-MM-DD`                          | `string \| null`                                     | —            |
| `month`（v-model）      | 显示的月份，`YYYY-MM`                             | `string`                                             | 选中日或今天 |
| `events`（v-model）     | 日程                                              | `CalendarEvent[]`                                    | `[]`         |
| `maxEvents`             | 每天最多列几项                                    | `number`                                             | `3`          |
| `weekStart`             | 每周从哪天开始，`0` 周日、`1` 周一                | `0 \| 1`                                             | 跟随语言     |
| `disabledDate`          | 不可选的日子                                      | `(date: string) => boolean`                          | —            |
| `view`（v-model）       | 当前视图                                          | `'month' \| 'week' \| 'day'`                         | `'month'`    |
| `views`                 | 可切换的视图，多于一个时显示切换按钮              | `CalendarViewMode[]`                                 | —            |
| `hours`                 | 周、日视图时间轴的起止小时                        | `[number, number]`                                   | `[0, 24]`    |
| `scrollTime`            | 周、日视图打开时滚动到的时间                      | `string`                                             | `'08:00'`    |
| `editable`              | 可以拖动、新建和删除日程，见[拖动编辑](#拖动编辑) | `boolean`                                            | `false`      |
| `snap`                  | 时间轴上拖动对齐的分钟数                          | `number`                                             | `15`         |
| `canMove`               | 写入前的检查，见[锁定与限制](#锁定与限制)         | `(move: CalendarMove) => boolean \| string`          | —            |
| `contextMenu`           | 自己的菜单项，见[右键菜单](#右键菜单)             | `(target: CalendarMenuTarget) => CalendarMenuItem[]` | —            |
| `menu`                  | 设置 `editable` 时在日程菜单里显示“删除日程”      | `boolean`                                            | `true`       |

`CalendarEvent` 的字段：

| 名称     | 说明                                                                                                 | 类型      |
| -------- | ---------------------------------------------------------------------------------------------------- | --------- |
| `id`     | 区分日程，各项不能重复                                                                               | `string`  |
| `start`  | 开始，`YYYY-MM-DD` 是全天日程，`YYYY-MM-DD HH:mm` 是带时间的日程                                     | `string`  |
| `end`    | 全天日程写最后一天 `YYYY-MM-DD`（包含这一天）；带时间的日程写结束的时刻 `YYYY-MM-DD HH:mm`，可以跨天 | `string`  |
| `title`  | 标题                                                                                                 | `string`  |
| `tone`   | 色调                                                                                                 | `Tone`    |
| `locked` | 设置 `editable` 时也不能拖动、调整或删除                                                             | `boolean` |
| `data`   | 自己的字段，例如地点、参会人；`CalendarEvent<Data>` 可以指定它的类型                                 | `Data`    |

写法与[甘特图](/gantt/data)的任务一致，同一份日程数据可以在两个组件之间直接使用。注意 `end` 只写日期时包含当天，写到分钟时是结束的那一刻：`'2026-10-05'` 表示 10 月 5 日整天，`'2026-10-05 00:00'` 是 10 月 4 日结束。`start` 只写日期而 `end` 写到分钟时，日历把它当作全天日程，显示到 `end` 那一天（`00:00` 则到前一天）；甘特图则按 `start` 当天 0 点到 `end` 的时刻计算。读不出的 `start` 会让这项日程不显示，开发时会在控制台提示一次。

### CalendarView Events

| 名称               | 说明                                                      | 参数                                              |
| ------------------ | --------------------------------------------------------- | ------------------------------------------------- |
| `select`           | 选中一天                                                  | `(date: string)`                                  |
| `eventClick`       | 点击一项日程                                              | `(event: CalendarEvent)`                          |
| `timeClick`        | 点击时间轴上的空白处                                      | `(start: string)`                                 |
| `change`           | 移动、调整或删除了一项日程，在 `update:events` 之后触发   | `(change: CalendarChange)`                        |
| `create`           | 拖出了一段时间                                            | `(range: { start: string; end: string })`         |
| `eventContextmenu` | 日程的菜单打开前触发，`event.preventDefault()` 可以不打开 | `(event: CalendarEvent, nativeEvent: MouseEvent)` |

```ts
type CalendarChange =
  | { kind: 'move' | 'resize'; event: CalendarEvent; previous: CalendarEvent }
  | { kind: 'remove'; event: CalendarEvent }

interface CalendarMove {
  kind: 'move' | 'resize' | 'create'
  event: CalendarEvent | null // 新建时是 null
  start: string
  end: string
}

type CalendarMenuTarget =
  | { kind: 'event'; event: CalendarEvent }
  | { kind: 'day'; date: string }
  | { kind: 'time'; start: string }

interface CalendarMenuItem {
  key: string
  label: string
  icon?: Component
  shortcut?: string // 只用来显示，写法同 useHotkey
  disabled?: boolean
  tone?: 'danger'
  divided?: boolean // 上方画一条分隔线
  run: () => void
}
```

### CalendarView Slots

| 名称    | 说明                                      |
| ------- | ----------------------------------------- |
| `cell`  | 替换日期下面的内容，参数见上              |
| `event` | 替换一项日程的文字，参数 `{ event, day }` |
| `extra` | 导航按钮前的内容                          |

### CalendarView Exposes

| 名称    | 说明           | 类型                     |
| ------- | -------------- | ------------------------ |
| `show`  | 翻到某天或某月 | `(date: string) => void` |
| `focus` | 聚焦当前日子   | `() => void`             |

### 键盘与读屏

- 月份是一个 `role="grid"`，只有当前日子在 Tab 顺序里：方向键按天、按周移动，<DouKbd>Home</DouKbd> / <DouKbd>End</DouKbd> 到本周首尾，<DouKbd>PageUp</DouKbd> / <DouKbd>PageDown</DouKbd> 翻月（加 <DouKbd>Shift</DouKbd> 翻年），<DouKbd>Enter</DouKbd> 选中。
- 当前日子里的日程可以用 <DouKbd>Tab</DouKbd> 进入。
- 周视图和日视图的表头日期可以用 <DouKbd>←</DouKbd> / <DouKbd>→</DouKbd> 移动；每件带时间的日程读作标题加起止时间，跨天的再加上起止日期；跨几天的日程只在显示出来的第一天进入 Tab 顺序。
- 每个日子读作完整日期，有日程时加上“N 项日程”；今天带 `aria-current="date"`，月份标题变化时会被读出。
- 设置 `editable` 时，焦点在日程上按 <DouKbd>Alt</DouKbd> + <DouKbd>←</DouKbd> / <DouKbd>→</DouKbd> 提前、推后一天；<DouKbd>Alt</DouKbd> + <DouKbd>↑</DouKbd> / <DouKbd>↓</DouKbd> 在时间轴上提前、推后 `snap` 分钟，在月视图里提前、推后一周。再加 <DouKbd>Shift</DouKbd> 只移动结束时间。<DouKbd>Delete</DouKbd> 删除，菜单键或 <DouKbd>Shift</DouKbd> + <DouKbd>F10</DouKbd> 打开菜单。每次修改后会读出日程的新时间，被拒绝时读出原因。
