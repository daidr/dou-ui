# CalendarHeatmap 日历热力图

按天显示一段时间内的数值，颜色越深数值越大。

## 基础用法

`data` 是 `{ date, value }` 的数组，`date` 写作 `YYYY-MM-DD`，没有出现的日期按 0 计算，同一天出现多次时数值相加。默认显示截至今天的一年。

<DocDemo src="calendar-heatmap/basic" column />

每一列是一周，从上到下是一周的七天，每周的第一天跟随语言包的 `region.weekStart`。鼠标悬停或键盘聚焦到某一天时显示它的日期和数值；点击或按 `Enter` 触发 `select`。

## 范围与颜色

- `start`、`end` 指定显示的日期范围。
- 颜色由 `tone` 与空白格的颜色混合得到，亮色和暗色主题都适用。默认分 4 档，每档对应最大值的四分之一；`levels` 修改档数，`thresholds` 直接指定每档的最小值。
- `colors` 可以传入自己的一组颜色，从空白格到最深的一档。
- `tooltip` 插槽自定义悬停时显示的内容。

<DocDemo src="calendar-heatmap/custom" column />

格子的尺寸、间距和圆角可以用 CSS 变量调整：`--dou-calendar-heatmap-cell`（默认 12px）、`--dou-calendar-heatmap-gap`（默认 2px）、`--dou-calendar-heatmap-radius`（默认 2px）。比容器宽时可以横向滚动。

## API

### CalendarHeatmap Props

| 名称         | 说明                               | 类型                                | 默认值         |
| ------------ | ---------------------------------- | ----------------------------------- | -------------- |
| `data`       | 每天的数值                         | `{ date: string; value: number }[]` | `[]`           |
| `start`      | 第一天                             | `string`                            | `end` 的一年前 |
| `end`        | 最后一天                           | `string`                            | 今天           |
| `tone`       | 颜色                               | `Tone`                              | `'primary'`    |
| `levels`     | 数值大于 0 时分几档                | `number`                            | `4`            |
| `thresholds` | 每档的最小值，从小到大             | `number[]`                          | —              |
| `colors`     | 自定义颜色，从空白格到最深一档     | `string[]`                          | —              |
| `week-start` | 每周第一天，`0` 为周日，`1` 为周一 | `0 \| 1`                            | 语言包设置     |
| `legend`     | 显示“少 … 多”图例                  | `boolean`                           | `true`         |

### CalendarHeatmap Events

| 名称     | 说明                          | 参数                                       |
| -------- | ----------------------------- | ------------------------------------------ |
| `select` | 点击某一天，或按 `Enter` 选择 | `(datum: { date: string; value: number })` |

### CalendarHeatmap Slots

| 名称      | 说明                   | 参数                                             |
| --------- | ---------------------- | ------------------------------------------------ |
| `tooltip` | 悬停或聚焦时显示的内容 | `{ date: string; value: number; level: number }` |
| `legend`  | 替换图例               | `{ colors: string[] }`                           |

### 键盘与读屏

- 根元素是 `role="grid"`，每一天是 `role="gridcell"`，读出的名称为日期和数值（来自语言包的 `calendarHeatmap.day`）。整个图在 `Tab` 顺序里只占一个位置。
- `←` `→` 前后移动一周，`↑` `↓` 前后移动一天，`Home` `End` 跳到第一天和最后一天；`Enter` 或 `Space` 选择。
- 月份和星期的标签只用于显示，读屏会跳过。
