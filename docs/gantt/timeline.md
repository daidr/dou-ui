# 时间轴

这一页介绍时间刻度、时间轴的范围和工作日历。

## 时间刻度

不传 `scale` 时，甘特图打开时会选一个能放下全部任务的日宽，并滚动到第一个任务。`v-model:scale` 切换时间刻度：`second`、`minute`、`hour`、`day`、`week`、`month`、`quarter`、`year`。

<DocDemo src="gantt/scales" column />

按住 `Ctrl` / `⌘` 滚动滚轮、在触控板上捏合或在触屏上双指捏合可以连续缩放：

- 缩放以指针（或两指中间）所在的时间为中心；
- 日宽跨过某一级的范围时自动换成那一级的表头，`scale` 也随之更新。

通过 ref 可以调用 `zoomIn()`、`zoomOut()` 缩放，`fit()` 重新选一个能放下全部任务的日宽，也可以传入 `[start, end]` 精确适配一段预设时间窗（如最近 15 分钟或 1 小时）。

## 范围

时间轴默认没有尽头：从全部任务所在的时间开始，往哪边滚动就往哪边延伸，不需要设置范围。需要固定范围时传 `range`，如 `['2026-01-01', '2026-12-31']` 或毫秒时间戳区间。

`scrollToDate(date)`、`scrollToToday()`、`scrollToTask(id)` 滚动到某个时间、现在或某个任务。`today` 设为 `false` 时不画当前时间线。只读模式（`readonly`）下可以直接按住鼠标在时间轴上横向拖动平移。

## 实时监控时间线

实时监控、任务执行轨迹等 24/7 连续时间场景，可以把以下几项组合起来使用：

- `:calendar="false"` 关闭工作日历与非工作时段底纹，所有时长按连续时间计算；
- `v-model:scale` 支持 `minute` 和 `second` 两级亚小时刻度，表头按 1/5/10/15/30 分钟或 1/5/10/15/30 秒自适应步进；
- `v-model:follow` 开启“跟随当前时间”模式：当前时间线每秒更新，自动保持在视口右侧留白处；用户手动横向滚动、滚轮横向平移、拖动时间轴或调用 `scrollToDate` 时自动将 `follow` 置为 `false`，点击“回到现在”可重新开启；
- `fit([start, end])` 适配预设时间窗，若处于跟随状态且窗口右端紧贴当前时间，缩放后会保持跟随。

<DocDemo src="gantt/live" column />

## 工作日历

`calendar` 设置哪些天、哪些时段上班。周末和节假日在时间轴上画成浅色底纹，工期按工作日计算；时间精确到分钟或秒的任务，工期按工作时段计算。设为 `false` 时关闭工作日历，不再绘制底纹，按 24/7 连续时间计算。

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

| 名称             | 说明                                                                                   | 类型                     | 默认值         |
| ---------------- | -------------------------------------------------------------------------------------- | ------------------------ | -------------- |
| `v-model:scale`  | 时间刻度：`second` / `minute` / `hour` / `day` / `week` / `month` / `quarter` / `year` | `GanttScale`             | 按内容自动选择 |
| `v-model:follow` | 跟随当前时间到视口右侧，横向滚动或拖拽平移时自动关闭                                   | `boolean`                | `false`        |
| `range`          | 固定时间轴的范围；不设时两端随滚动延伸                                                 | `[GanttTime, GanttTime]` | —              |
| `today`          | 显示当前时间线                                                                         | `boolean`                | `true`         |
| `weekStart`      | 一周的第一天：`0` 周日，`1` 周一                                                       | `0 \| 1`                 | 跟随语言       |
| `calendar`       | 工作日历；设为 `false` 关闭非工作时段底纹，按 24/7 连续时间计算                        | `GanttCalendar \| false` | —              |

### GanttCalendar

| 名称       | 说明                                   | 类型                                     | 默认值               |
| ---------- | -------------------------------------- | ---------------------------------------- | -------------------- |
| `weekends` | 每周休息的日子，`0` 是周日             | `number[]`                               | `[0, 6]`             |
| `holidays` | 额外的休息日，`YYYY-MM-DD`             | `string[]`                               | —                    |
| `workdays` | 调休上班的日子，优先于 `weekends`      | `string[]`                               | —                    |
| `hours`    | 每个工作日的上班时段，有午休时写成多段 | `[string, string] \| [string, string][]` | `['09:00', '18:00']` |

### 相关 Exposes

| 名称                 | 说明                                                     | 类型                                       |
| -------------------- | -------------------------------------------------------- | ------------------------------------------ |
| `zoomIn` / `zoomOut` | 放大、缩小时间轴，视图中间的时间（或跟随时当前时间）不动 | `() => void`                               |
| `fit`                | 缩放到放下全部任务，或传入 `[start, end]` 适配指定时间窗 | `(range?: [GanttTime, GanttTime]) => void` |
| `scrollToDate`       | 滚动到某个时间                                           | `(date: GanttTime) => void`                |
| `scrollToToday`      | 滚动到现在；跟随模式开启时重新对齐到视口右侧             | `() => void`                               |
| `scrollToTask`       | 滚动到某个任务                                           | `(id: string) => void`                     |
