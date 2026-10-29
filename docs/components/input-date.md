# InputDate 日期输入

用于按年、月、日分段输入日期，适合需要大量手动录入的表单。

## 基础用法

<DocDemo src="input-date/basic" />

点击或用 `Tab` 进入某一段后直接输入数字。一段输满，或者再输入一位就会超出范围时（比如月份输入 `3`），会自动跳到下一段；也可以输入 `-`、`/`、`.` 或空格跳到下一段。所有段都填好后才会更新值，没填完时值是 `null`。

值的形式和 DatePicker 一样：`YYYY-MM-DD` 字符串，不含时区。

## 键盘操作

| 按键                 | 行为                                        |
| -------------------- | ------------------------------------------- |
| 数字                 | 输入当前段                                  |
| `↑` `↓`              | 当前段加一 / 减一，月、日、时、分循环       |
| `PageUp` `PageDown`  | 大步调整：年 10、月 3、日 7、分秒 10        |
| `Home` `End`         | 当前段的最小值 / 最大值                     |
| `←` `→`              | 切换到相邻的段                              |
| `Backspace` `Delete` | 清空当前段，已为空时 `Backspace` 回到上一段 |
| `Alt` + `↓`          | 设置 `picker` 时打开日历                    |

空的年份按 `↑` `↓` 会从今年开始。月份改变后，日期如果超出当月天数，会落到当月最后一天。也可以直接粘贴 `2026-10-29`、`2026/10/29` 这样的文本。

## 类型

`type` 可以是 `date`、`datetime`、`month`、`year`。`datetime` 的值是 `YYYY-MM-DD HH:mm`，设置 `time-format="HH:mm:ss"` 时带秒。

<DocDemo src="input-date/type" />

## 显示格式

各段的顺序和分隔符默认取语言包：中文是 `YYYY-MM-DD`，英文是 `MM/DD/YYYY`，英文的时间还会用 12 小时制。`display-format` 可以单独指定，可用的段有 `YYYY`、`MM`、`DD`、`HH`（24 小时）、`hh` 与 `A`（12 小时与上午 / 下午）、`mm`、`ss`，方括号里的文字原样显示。

显示格式只影响显示和输入，值始终是固定格式。格式缺少当前类型需要的段时，会改用语言包的格式。

<DocDemo src="input-date/display-format" />

## 弹出日历

设置 `picker` 后，前面的日历图标变成按钮，点击或按 `Alt` + `↓` 打开日历。在日历里选好日期会填入年、月、日三段；`datetime` 如果还没有时间，会填入当天开始的时间。

<DocDemo src="input-date/picker" />

## 日期范围

`range` 显示开始和结束两组段，只用于 `date` 和 `datetime`。值是 `[开始, 结束]`，开始晚于结束时会自动交换，离开字段后按顺序显示。

<DocDemo src="input-date/range" />

## 可选范围

`min`、`max` 限定最早和最晚的日期，`disabled-date` 排除单独的日子。填好的日期不在范围内时，字段标记为无效，值保持 `null`。

<DocDemo src="input-date/bounds" />

## 尺寸与状态

<DocDemo src="input-date/size-state" />

## 读屏

字段是 `role="group"`，每一段是 `role="spinbutton"`，带 `aria-valuenow`、`aria-valuemin`、`aria-valuemax` 和读出的文字 `aria-valuetext`，空的段读作"空"。段的名称来自语言包，范围时前面加上"开始日期""结束日期"。

## API

### InputDate Props

| 名称            | 说明                                | 类型                                        | 默认值           |
| --------------- | ----------------------------------- | ------------------------------------------- | ---------------- |
| `modelValue`    | 值，配合 `v-model`                  | `string \| [string, string] \| null`        | —                |
| `type`          | 输入的类型                          | `'date' \| 'datetime' \| 'month' \| 'year'` | `'date'`         |
| `timeFormat`    | `datetime` 是否带秒                 | `'HH:mm' \| 'HH:mm:ss'`                     | `'HH:mm'`        |
| `displayFormat` | 显示格式                            | `string`                                    | 语言包           |
| `range`         | 输入一段日期                        | `boolean`                                   | `false`          |
| `min`           | 最早可输入的值，包含在内            | `string`                                    | —                |
| `max`           | 最晚可输入的值，包含在内            | `string`                                    | —                |
| `disabledDate`  | 排除单独的日子，参数是 `YYYY-MM-DD` | `(date: string) => boolean`                 | —                |
| `minuteStep`    | `datetime` 分钟段按方向键时的步长   | `number`                                    | `1`              |
| `secondStep`    | `datetime` 秒段按方向键时的步长     | `number`                                    | `1`              |
| `picker`        | 图标变成按钮，可以打开日历          | `boolean`                                   | `false`          |
| `weekStart`     | 日历每周的第一天，`0` 是周日        | `0 \| 1`                                    | 语言包           |
| `clearable`     | 显示清空按钮                        | `boolean`                                   | `false`          |
| `size`          | 尺寸，默认取表单或全局配置          | `'sm' \| 'md' \| 'lg'`                      | `'md'`           |
| `disabled`      | 禁用                                | `boolean`                                   | `false`          |
| `readonly`      | 只读，可以聚焦但不能修改            | `boolean`                                   | `false`          |
| `invalid`       | 标记为无效                          | `boolean`                                   | `false`          |
| `placement`     | 日历弹出的位置                      | `Placement`                                 | `'bottom-start'` |
| `teleport`      | 日历渲染到哪里，`false` 留在原处    | `string \| HTMLElement \| false`            | `'body'`         |

### InputDate Events

| 名称                | 说明                               | 参数                                          |
| ------------------- | ---------------------------------- | --------------------------------------------- |
| `update:modelValue` | 值变化                             | `(value: string \| [string, string] \| null)` |
| `change`            | 用户输入、调整、选择或清空后值变化 | `(value: string \| [string, string] \| null)` |

### InputDate Exposes

| 名称    | 说明                           | 类型         |
| ------- | ------------------------------ | ------------ |
| `focus` | 聚焦第一个空的段，没有则第一段 | `() => void` |
| `blur`  | 移除焦点                       | `() => void` |
