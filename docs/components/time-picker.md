# TimePicker 时间选择

用于选择或输入时间，支持时间范围。

## 值的形式

值是 24 小时制的字符串：`HH:mm`，或 `format="HH:mm:ss"` 时带秒；范围是 `[开始, 结束]`。和日期一样不含时区，可以直接比较大小。

## 基础用法

<DocDemo src="time-picker/basic" />

点击某一列的数字会立即改动值，不用再确认；“此刻”选中当前时间，“确定”关闭弹出层。也可以直接输入：`9`、`9:5`、`09：30` 都能识别，按 `Enter` 或离开字段时生效，无法识别的输入会恢复成原来的值。

## 时间范围

`range` 用两个输入框表示开始和结束，弹出层里左右各一组列。关闭时如果开始晚于结束，会自动交换。

<DocDemo src="time-picker/time-range" />

## 步长

`hour-step`、`minute-step`、`second-step` 让列里只出现整倍数；输入的值会就近落到步长上。

<DocDemo src="time-picker/step" />

## 尺寸与状态

<DocDemo src="time-picker/size-state" />

## 键盘与读屏

输入框是 `role="combobox"`，`aria-haspopup="dialog"`。在输入框里按 `↓` 进入第一列，`Esc` 关闭并回到输入框。每一列是一个 `role="listbox"`，名称是“时”“分”“秒”；选中的数字 `aria-selected="true"`。

| 按键         | 行为              |
| ------------ | ----------------- |
| `↑` `↓`      | 上一个 / 下一个值 |
| `←` `→`      | 切换到相邻的列    |
| `Home` `End` | 第一个 / 最后一个 |
| `Enter`      | 关闭并回到输入框  |

## API

### TimePicker Props

| 名称               | 说明                         | 类型                                 | 默认值           |
| ------------------ | ---------------------------- | ------------------------------------ | ---------------- |
| `modelValue`       | 值，配合 `v-model`           | `string \| [string, string] \| null` | —                |
| `format`           | 是否带秒                     | `'HH:mm' \| 'HH:mm:ss'`              | `'HH:mm'`        |
| `range`            | 选择一段时间                 | `boolean`                            | `false`          |
| `hourStep`         | 小时列的步长                 | `number`                             | `1`              |
| `minuteStep`       | 分钟列的步长                 | `number`                             | `1`              |
| `secondStep`       | 秒列的步长                   | `number`                             | `1`              |
| `placeholder`      | 占位文字                     | `string`                             | 语言包           |
| `startPlaceholder` | 范围开始的占位文字           | `string`                             | 语言包           |
| `endPlaceholder`   | 范围结束的占位文字           | `string`                             | 语言包           |
| `clearable`        | 显示清空按钮                 | `boolean`                            | `false`          |
| `size`             | 尺寸，默认取表单或全局配置   | `'sm' \| 'md' \| 'lg'`               | `'md'`           |
| `disabled`         | 禁用                         | `boolean`                            | `false`          |
| `invalid`          | 标记为无效                   | `boolean`                            | `false`          |
| `placement`        | 弹出的位置                   | `Placement`                          | `'bottom-start'` |
| `teleport`         | 渲染到哪里，`false` 留在原处 | `string \| HTMLElement \| false`     | `'body'`         |

### TimePicker Events

| 名称                | 说明                 | 参数                                          |
| ------------------- | -------------------- | --------------------------------------------- |
| `update:modelValue` | 值变化               | `(value: string \| [string, string] \| null)` |
| `change`            | 用户选中、输入或清空 | `(value: string \| [string, string] \| null)` |
