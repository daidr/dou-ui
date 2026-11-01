# DatePicker 日期选择

用于选择或输入日期，支持日期时间、周、月份、季度、年份和范围选择。

## 值的形式

值是不带时区的字符串：日期是 `YYYY-MM-DD`，日期时间是 `YYYY-MM-DD HH:mm`（或带秒），周是 ISO 周 `YYYY-Www`，月份是 `YYYY-MM`，季度是 `YYYY-Qn`，年份是 `YYYY`，范围是 `[开始, 结束]`。值表示日历上的日期和时间，而不是某个时刻，可以直接比较大小或提交给后端，不会因为时区不同而相差一天。需要 `Date` 时自行转换，日期时间用 `new Date(value.replace(' ', 'T'))` 按本地时间读出。

## 基础用法

<DocDemo src="date-picker/basic" />

点击字段打开日历，选中后关闭。也可以直接输入：`2026-10-28`、`2026/10/28`、`2026.10.28` 都能识别，按 `Enter` 或离开字段时生效；无效或不可选的输入会恢复成原来的值。日历底部的“今天”按钮选中今天（今天不可选时不显示）。

## 月份与年份

`type` 为 `month` 或 `year` 时，日历直接从月份或年份开始。

<DocDemo src="date-picker/month-year" />

## 季度

`type="quarter"` 选择季度，值为 `2026-Q4` 这样的形式。输入框中的写法来自语言包的 `datePicker.quarter`：中文显示为“2026 年第 4 季度”，英文显示为“Q4 2026”。输入时这种写法和 `2026-Q4`、`2026 Q4`、`Q4 2026` 都能识别。

<DocDemo src="date-picker/quarter" />

## 日期时间

`type="datetime"` 在日历右侧加一组时、分列。先点日子再调时间，或者反过来；面板不会因为点了日子就关闭，按“确定”才生效，“此刻”直接选中现在。`time-format="HH:mm:ss"` 带上秒。

<DocDemo src="date-picker/datetime" />

也可以直接输入 `2026-10-28 14:30`，日期和时间之间用空格或 `T`；只输入日期时，时间取 `defaultTime`。

### 日期时间范围

和 `range` 一起用时，开始和结束各有一组时间列。只点了日子没有调时间的话，开始取当天 00:00，结束取当天 23:59，按天筛选时正好覆盖首尾两天；用 `defaultTime` 传一对时间可以改掉。

<DocDemo src="date-picker/datetime-range" />

### 禁用时间

`disabledTime` 接收日期（`YYYY-MM-DD`），返回这一天的时间规则，写法与 [TimePicker 的 `disabledTime`](./time-picker#禁用时间) 相同；返回空表示这一天的时间都可选。常见的用法是今天只能选现在以后的时间。换到另一天时，如果已选的时间在这一天不可选，会移到这一天第一个可选的时间。

`disabledTime` 只限制时间，日期本身仍然可以点。如果某一天的时间全部不可选（比如临近午夜时的今天），请同时在 `disabledDate` 里排除这一天，示例里就是这样处理的。

<DocDemo src="date-picker/disabled-time" />

## 周

`type="week"` 选一整周，值为 ISO 周：周一开始，包含当年第一个周四的那一周是第 1 周，跨年的周归属于它的周四所在的年份。日历固定从周一开始，指向某一行时整行显示底色，点哪一天都选中它所在的周。可以输入 `2026-W44` 或 `2026 44`。

<DocDemo src="date-picker/week" />

## 日期范围

`range` 用两个输入框表示开始和结束，日历并排显示两个月。第一次点击定下一端，移动时预览范围，第二次点击定下另一端，先后顺序不限。

<DocDemo src="date-picker/date-range" />

`range` 也可以和 `month`、`quarter`、`year` 一起使用，在对应的格子里选择开始和结束，周不支持范围。

## 可选范围

`min` / `max` 限定最早和最晚（包含两端），`disabledDate` 排除单独的日子。不可选的日子会淡下去，比相邻月份的日子更浅，也点不动。

<DocDemo src="date-picker/range" />

## 快捷选项

`shortcuts` 在日历左侧列出一组预设，点击即选中并关闭。`value` 可以是值本身，也可以是函数，在点击的那一刻才计算，“最近 7 天”这类相对今天的预设不会因为页面开得久而过期。

<DocDemo src="date-picker/shortcuts" />

需要别的布局时，`footer` 插槽放在日历底部，参数 `pick(value)` 直接选中一个值并关闭。

<DocDemo src="date-picker/shortcuts-2" />

## 单独使用日历

`DouCalendar` 是弹出层里的日历本身，可以直接放在页面上，接受同样的 `type`、`range`、`min`、`max`、`disabledDate`。它不画外框，放在什么容器里就是什么样子。

<DocDemo src="date-picker/calendar" />

## 尺寸与状态

<DocDemo src="date-picker/size-state" />

## 显示格式

输入框里的写法默认来自语言包的 `region`：中文是 `YYYY-MM-DD`，英文是 `MM/DD/YYYY`。`displayFormat` 可以单独指定，`YYYY`、`MM`、`DD` 是年月日，`[]` 里的文字原样保留。格式只影响显示和输入，`v-model` 的值始终是 `YYYY-MM-DD` 这样的形式；输入 `2026-10-29` 这样的写法也总能识别。周始终使用 ISO 写法，季度使用语言包的 `datePicker.quarter`。

<DocDemo src="date-picker/display-format" />

在选择器之外按同样的写法显示一个值（比如详情页、表格里），用 `formatDateValue(value, { locale, type?, displayFormat? })`，`locale` 可以从 `useLocale()` 拿到。

## 一周的第一天

默认取语言包的 `region.weekStart`：`zhCN` 从周一开始，`en` 从周日开始。`weekStart` 可以指定 `0`（周日）或 `1`（周一）。星期与月份的名称来自浏览器的 `Intl`，跟随语言包的 `name`，不需要另外翻译。

## 键盘与读屏

输入框是 `role="combobox"`，`aria-haspopup="dialog"`，指向弹出的 `role="dialog"`。在输入框里按 `↓` 进入日历，`Esc` 关闭并回到输入框。

日历是 `role="grid"` 的表格，列头带完整的星期名称（`abbr`），每一天是一个按钮，读出完整日期（“2026年10月28日星期三”）；今天带 `aria-current="date"`，选中的格子 `aria-selected="true"`。只有当前日期在 `Tab` 顺序里：

| 按键                            | 行为                  |
| ------------------------------- | --------------------- |
| `←` `→`                         | 前一天 / 后一天       |
| `↑` `↓`                         | 上一周 / 下一周       |
| `Home` `End`                    | 本周第一天 / 最后一天 |
| `PageUp` `PageDown`             | 上个月 / 下个月       |
| `Shift` + `PageUp` / `PageDown` | 上一年 / 下一年       |
| `Enter` `Space`                 | 选中                  |

在月份、季度和年份视图里，方向键按格移动，`PageUp` / `PageDown` 翻一年或十年。

## API

### DatePicker Props

| 名称               | 说明                                                                    | 类型                                                               | 默认值                       |
| ------------------ | ----------------------------------------------------------------------- | ------------------------------------------------------------------ | ---------------------------- |
| `modelValue`       | 值，配合 `v-model`                                                      | `string \| [string, string] \| null`                               | —                            |
| `type`             | 选择日期、日期时间、周、月份、季度还是年份                              | `'date' \| 'datetime' \| 'week' \| 'month' \| 'quarter' \| 'year'` | `'date'`                     |
| `range`            | 选择一段时间，周不支持                                                  | `boolean`                                                          | `false`                      |
| `timeFormat`       | 日期时间是否带秒                                                        | `'HH:mm' \| 'HH:mm:ss'`                                            | `'HH:mm'`                    |
| `displayFormat`    | 输入框中日期的写法                                                      | `string`                                                           | 语言包                       |
| `defaultTime`      | 只选了日子时取的时间；范围可传一对                                      | `string \| [string, string]`                                       | 开始 00:00，结束 23:59       |
| `shortcuts`        | 日历左侧的预设                                                          | `{ label: string; value: 值 \| (() => 值) }[]`                     | —                            |
| `min`              | 最早可选，包含                                                          | `string`                                                           | —                            |
| `max`              | 最晚可选，包含                                                          | `string`                                                           | —                            |
| `disabledDate`     | 排除某些日子                                                            | `(date: string) => boolean`                                        | —                            |
| `disabledTime`     | `datetime` 某一天不可选的时、分、秒                                     | `(date: string) => DisabledTime \| undefined`                      | —                            |
| `weekStart`        | 一周的第一天                                                            | `0 \| 1`                                                           | 语言包                       |
| `panels`           | 并排显示几个月                                                          | `1 \| 2`                                                           | 范围为 2（窄屏为 1），否则 1 |
| `placeholder`      | 占位文字                                                                | `string`                                                           | 语言包                       |
| `startPlaceholder` | 范围开始的占位文字                                                      | `string`                                                           | 语言包                       |
| `endPlaceholder`   | 范围结束的占位文字                                                      | `string`                                                           | 语言包                       |
| `clearable`        | 显示清空按钮                                                            | `boolean`                                                          | `false`                      |
| `size`             | 尺寸，默认取表单或全局配置                                              | `'sm' \| 'md' \| 'lg'`                                             | `'md'`                       |
| `disabled`         | 禁用                                                                    | `boolean`                                                          | `false`                      |
| `readonly`         | 只读：值照常显示、可以聚焦，但不能修改；Form 设置 `readonly` 时自动只读 | `boolean`                                                          | `false`                      |
| `invalid`          | 标记为无效                                                              | `boolean`                                                          | `false`                      |
| `placement`        | 日历弹出的位置                                                          | `Placement`                                                        | `'bottom-start'`             |
| `teleport`         | 日历渲染到哪里，`false` 留在原处                                        | `string \| HTMLElement \| false`                                   | `'body'`                     |

### DatePicker Events

| 名称                | 说明                 | 参数                                          |
| ------------------- | -------------------- | --------------------------------------------- |
| `update:modelValue` | 值变化               | `(value: string \| [string, string] \| null)` |
| `change`            | 用户选中、输入或清空 | `(value: string \| [string, string] \| null)` |
| `select`            | 在日历里选中         | `(value: string \| [string, string])`         |

### DatePicker Slots

| 名称     | 说明                        |
| -------- | --------------------------- |
| `footer` | 日历底部，参数为 `{ pick }` |

### Calendar

`DouCalendar` 接受 DatePicker 中 `modelValue`、`type`（不含 `datetime`）、`range`、`min`、`max`、`disabledDate`、`weekStart`、`panels` 这几项，触发 `update:modelValue` 与 `select`。插槽 `cell` 替换日期格里的数字（参数 `{ date, day }`），`footer` 放在底部。暴露 `focus()` 和 `show(value)`（翻到某个值所在的月份）。
