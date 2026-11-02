# 时间轴

这一页介绍时间刻度、时间轴的范围和工作日历。

## 时间刻度

不传 `scale` 时，甘特图打开时会选一个能放下全部任务的日宽，并滚动到第一个任务。`v-model:scale` 切换时间刻度：`hour`、`day`、`week`、`month`、`quarter`、`year`。

<DocDemo src="gantt/scales" column />

按住 `Ctrl` / `⌘` 滚动滚轮、在触控板上捏合或在触屏上双指捏合可以连续缩放：

- 缩放以指针（或两指中间）所在的时间为中心；
- 日宽跨过某一级的范围时自动换成那一级的表头，`scale` 也随之更新。

通过 ref 可以调用 `zoomIn()`、`zoomOut()` 缩放，`fit()` 重新选一个能放下全部任务的日宽。

## 范围

时间轴默认覆盖全部任务，两边各留出一屏的空白；滚动到任一端时会继续向外延伸，不需要设置范围。需要固定范围时传 `range`，如 `['2026-01-01', '2026-12-31']`。

`scrollToDate(date)`、`scrollToToday()`、`scrollToTask(id)` 滚动到某个时间、现在或某个任务。`today` 设为 `false` 时不画当前时间线。

## 工作日历

`calendar` 设置哪些天、哪些时段上班。周末和节假日在时间轴上画成浅色底纹，工期按工作日计算；时间精确到分钟的任务，工期按工作时段计算，显示为小时数。

<DocDemo src="gantt/calendar" column />

```ts
import type { GanttCalendar } from '@dou-ui/gantt'

const calendar: GanttCalendar = {
  holidays: ['2026-10-01', '2026-10-02'],
  workdays: ['2026-10-10'], // 调休上班
  hours: [
    ['09:00', '12:00'],
    ['13:00', '18:00'],
  ],
}
```

`weekStart` 设置一周的第一天，默认跟随语言。

## API

### 相关 Props

| 名称            | 说明                                               | 类型               | 默认值         |
| --------------- | -------------------------------------------------- | ------------------ | -------------- |
| `v-model:scale` | 时间刻度                                           | `GanttScale`       | 按内容自动选择 |
| `range`         | 固定时间轴的范围；不设时跟随任务，滚到两头继续延伸 | `[string, string]` | —              |
| `today`         | 显示当前时间线                                     | `boolean`          | `true`         |
| `weekStart`     | 一周的第一天：`0` 周日，`1` 周一                   | `0 \| 1`           | 跟随语言       |
| `calendar`      | 工作日历                                           | `GanttCalendar`    | —              |

### GanttCalendar

| 名称       | 说明                                   | 类型                                     | 默认值               |
| ---------- | -------------------------------------- | ---------------------------------------- | -------------------- |
| `weekends` | 每周休息的日子，`0` 是周日             | `number[]`                               | `[0, 6]`             |
| `holidays` | 额外的休息日，`YYYY-MM-DD`             | `string[]`                               | —                    |
| `workdays` | 调休上班的日子，优先于 `weekends`      | `string[]`                               | —                    |
| `hours`    | 每个工作日的上班时段，有午休时写成多段 | `[string, string] \| [string, string][]` | `['09:00', '18:00']` |

### 相关 Exposes

| 名称                 | 说明                                           | 类型                     |
| -------------------- | ---------------------------------------------- | ------------------------ |
| `zoomIn` / `zoomOut` | 放大、缩小时间轴，视图中间的时间不动           | `() => void`             |
| `fit`                | 选一个能放下全部任务的日宽，并滚动到第一个任务 | `() => void`             |
| `scrollToDate`       | 滚动到某个时间                                 | `(date: string) => void` |
| `scrollToToday`      | 滚动到现在                                     | `() => void`             |
| `scrollToTask`       | 滚动到某个任务                                 | `(id: string) => void`   |
