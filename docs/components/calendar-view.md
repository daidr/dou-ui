# CalendarView 日历视图

按月、周或日展示日程的日历。

和 [DatePicker](./date-picker) 里的 `DouCalendar` 不同，这里每个格子都有地方放内容，适合排班、日程、发布计划这类场景。

## 基础用法

`events` 是一组 `{ start, title, tone? }`，`start` 写成 `YYYY-MM-DD`。`end` 写最后一天，让一件事跨几天，跨天的标签首尾相连。每天最多列 `max-events`（默认 3）项，其余折成“还有 N 项”。点日子触发 `select` 并更新 `v-model`，点日程触发 `event-click`。

<DocDemo src="calendar-view/basic" column />

## 周视图与日视图

`view` 切换月、周、日三种视图，配合 `v-model:view` 使用；传入 `views` 时在导航旁显示切换按钮。周视图和日视图沿纵向时间轴排布：`start` 带时间（`YYYY-MM-DD HH:mm`）的日程按时段放置，`end` 是结束的时刻，不填时按一小时算；时间重叠的日程并排显示，过了零点的日程在每一天的列里各画一段。`start` 只写日期的是全天日程，放在顶部的“全天”一行。今天的列里有一条当前时间线。

`hours` 设置时间轴覆盖的时段，`scroll-time` 是打开时滚动到的时间。点击时间轴上的空白处触发 `time-click`，参数是取整到半小时的 `YYYY-MM-DD HH:mm`，可以直接作为新日程的 `start`。

<DocDemo src="calendar-view/week" column />

## 自定义格子

`cell` 插槽替换日期下面的内容，参数里有 `date`、`day`、`outside`、`today`、`selected`、`disabled` 和当天的 `events`。下面按星期几画一张排班表，周末不可选：

<DocDemo src="calendar-view/custom-cell" column />

格子的最小高度来自 CSS 变量 `--dou-calendar-view-day-height`（默认 112px）。`extra` 插槽放在右上角导航按钮的前面，适合放视图切换。

## API

### CalendarView Props

| 名称                    | 说明                                 | 类型                         | 默认值       |
| ----------------------- | ------------------------------------ | ---------------------------- | ------------ |
| `modelValue`（v-model） | 选中的日子，`YYYY-MM-DD`             | `string \| null`             | —            |
| `month`（v-model）      | 显示的月份，`YYYY-MM`                | `string`                     | 选中日或今天 |
| `events`                | 日程                                 | `CalendarEvent[]`            | `[]`         |
| `maxEvents`             | 每天最多列几项                       | `number`                     | `3`          |
| `weekStart`             | 每周从哪天开始，`0` 周日、`1` 周一   | `0 \| 1`                     | 跟随语言     |
| `disabledDate`          | 不可选的日子                         | `(date: string) => boolean`  | —            |
| `view`（v-model）       | 当前视图                             | `'month' \| 'week' \| 'day'` | `'month'`    |
| `views`                 | 可切换的视图，多于一个时显示切换按钮 | `CalendarViewMode[]`         | —            |
| `hours`                 | 周、日视图时间轴的起止小时           | `[number, number]`           | `[0, 24]`    |
| `scrollTime`            | 周、日视图打开时滚动到的时间         | `string`                     | `'08:00'`    |

`CalendarEvent` 的字段：

| 名称    | 说明                                                                                                 | 类型               |
| ------- | ---------------------------------------------------------------------------------------------------- | ------------------ |
| `id`    | 区分日程，不填时用 `start` 加标题                                                                    | `string \| number` |
| `start` | 开始，`YYYY-MM-DD` 是全天日程，`YYYY-MM-DD HH:mm` 是带时间的日程                                     | `string`           |
| `end`   | 全天日程写最后一天 `YYYY-MM-DD`（包含这一天）；带时间的日程写结束的时刻 `YYYY-MM-DD HH:mm`，可以跨天 | `string`           |
| `title` | 标题                                                                                                 | `string`           |
| `tone`  | 色调                                                                                                 | `Tone`             |

写法与[甘特图](/gantt/data)的任务一致，同一份日程数据可以在两个组件之间直接使用。注意 `end` 只写日期时包含当天，写到分钟时是结束的那一刻：`'2026-10-05'` 表示 10 月 5 日整天，`'2026-10-05 00:00'` 是 10 月 4 日结束。读不出的 `start` 会让这项日程不显示，开发时会在控制台提示一次。

### CalendarView Events

| 名称         | 说明                 | 参数                     |
| ------------ | -------------------- | ------------------------ |
| `select`     | 选中一天             | `(date: string)`         |
| `eventClick` | 点击一项日程         | `(event: CalendarEvent)` |
| `timeClick`  | 点击时间轴上的空白处 | `(start: string)`        |

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
- 周视图和日视图的表头日期可以用 <DouKbd>←</DouKbd> / <DouKbd>→</DouKbd> 移动；每件带时间的日程读作标题加起止时间，跨天的再加上起止日期。
- 每个日子读作完整日期，有日程时加上“N 项日程”；今天带 `aria-current="date"`，月份标题变化时会被读出。
