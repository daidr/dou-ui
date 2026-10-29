# CalendarView 日历视图

以月为单位展示的日历，每个日期格子中都可以放置日程等内容。

和 [DatePicker](./date-picker) 里的 `DouCalendar` 不同，这里每个格子都有地方放内容，适合排班、日程、发布计划这类月视图。

<script setup>
import { ref } from 'vue'
const date = ref('2026-10-29')
const month = ref('2026-10')
const last = ref('—')
const events = [
  { date: '2026-10-08', title: '第 11 批合并', tone: 'success' },
  { date: '2026-10-12', title: '设计评审' },
  { date: '2026-10-12', title: '图标复审', tone: 'neutral' },
  { date: '2026-10-12', title: '周会', tone: 'neutral' },
  { date: '2026-10-12', title: '发版前检查', tone: 'warning' },
  { date: '2026-10-19', end: '2026-10-21', title: '上海出差', tone: 'warning' },
  { date: '2026-10-29', title: '第 13 批开工' },
  { date: '2026-10-30', title: '修复回归问题', tone: 'danger' },
]
const shifts = [
  { label: '早班', tone: 'primary' },
  { label: '晚班', tone: 'warning' },
  { label: '休息', tone: 'neutral' },
]
const shiftOf = (date) => shifts[Number(date.slice(8)) % 3]
</script>

## 基础用法

`events` 是一组 `{ date, title, tone? }`，`end` 让一件事跨几天，跨天的标签首尾相连。每天最多列 `max-events`（默认 3）项，其余折成"还有 N 项"。点日子触发 `select` 并更新 `v-model`，点日程触发 `event-click`。

<div class="demo demo--column">
  <DouCalendarView v-model="date" v-model:month="month" :events="events" @event-click="(event) => (last = event.title)" />
  <DouText size="sm" variant="tertiary">选中：{{ date }}　显示的月份：{{ month }}　最近点击的日程：{{ last }}</DouText>
</div>

```vue
<DouCalendarView v-model="date" v-model:month="month" :events="events" @event-click="openEvent" />
```

```ts
const events = [
  { date: '2026-10-12', title: '设计评审' },
  { date: '2026-10-19', end: '2026-10-21', title: '上海出差', tone: 'warning' },
]
```

## 自定义格子

`cell` 插槽替换日期下面的内容，参数里有 `date`、`day`、`outside`、`today`、`selected`、`disabled` 和当天的 `events`。下面按星期几画一张排班表，周末不可选：

<div class="demo demo--column">
  <DouCalendarView style="--dou-calendar-view-day-height: 72px" :disabled-date="(d) => [0, 6].includes(new Date(d).getUTCDay())">
    <template #cell="{ date, outside, disabled }">
      <DouTag v-if="!outside && !disabled" size="sm" :tone="shiftOf(date).tone">
        {{ shiftOf(date).label }}
      </DouTag>
    </template>
  </DouCalendarView>
</div>

```vue
<DouCalendarView :disabled-date="isWeekend">
  <template #cell="{ date, outside }">
    <DouTag v-if="!outside" size="sm">{{ shiftOf(date) }}</DouTag>
  </template>
</DouCalendarView>
```

格子的最小高度来自 CSS 变量 `--dou-calendar-view-day-height`（默认 112px）。`extra` 插槽放在右上角导航按钮的前面，适合放视图切换。

## API

### CalendarView Props

| 名称                    | 说明                               | 类型                        | 默认值       |
| ----------------------- | ---------------------------------- | --------------------------- | ------------ |
| `modelValue`（v-model） | 选中的日子，`YYYY-MM-DD`           | `string \| null`            | —            |
| `month`（v-model）      | 显示的月份，`YYYY-MM`              | `string`                    | 选中日或今天 |
| `events`                | 日程                               | `CalendarEvent[]`           | `[]`         |
| `maxEvents`             | 每天最多列几项                     | `number`                    | `3`          |
| `weekStart`             | 每周从哪天开始，`0` 周日、`1` 周一 | `0 \| 1`                    | 跟随语言     |
| `disabledDate`          | 不可选的日子                       | `(date: string) => boolean` | —            |

`CalendarEvent` 为 `{ date: string; end?: string; title: string; tone?: Tone; key?: string | number }`。

### CalendarView Events

| 名称         | 说明         | 参数                     |
| ------------ | ------------ | ------------------------ |
| `select`     | 选中一天     | `(date: string)`         |
| `eventClick` | 点击一项日程 | `(event: CalendarEvent)` |

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
- 每个日子读作完整日期，有日程时加上"N 项日程"；今天带 `aria-current="date"`，月份标题变化时会被读出。
