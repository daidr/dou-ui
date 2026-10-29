# InputTime 时间输入

用于按时、分、秒分段输入时间，和 InputDate 的输入方式相同。

## 基础用法

<DocDemo src="input-time/basic" />

值是 24 小时制的 `HH:mm`，`format="HH:mm:ss"` 时带秒，和 TimePicker 相同。所有段都填好后才会更新值。键盘操作见 [InputDate](./input-date#键盘操作)。

## 12 小时制

`display-format` 里用 `hh` 和 `A` 显示 12 小时制，`A` 可以放在前面或后面，上午 / 下午一段可以用 `↑` `↓` 切换，也可以输入 `a`、`p`。值仍然是 24 小时制。英文语言包默认使用 12 小时制。

<DocDemo src="input-time/hour12" />

## 步长与弹出面板

`hour-step`、`minute-step`、`second-step` 设置按方向键时的步长，值落在步长的整倍数上。设置 `picker` 后，点击时钟图标或按 `Alt` + `↓` 打开时间列，点击某一格会立即填入。

<DocDemo src="input-time/step" />

## 时间范围

`range` 显示开始和结束两组段，值是 `[开始, 结束]`，开始晚于结束时会自动交换。

<DocDemo src="input-time/range" />

## 尺寸与状态

<DocDemo src="input-time/size-state" />

## API

### InputTime Props

| 名称            | 说明                             | 类型                                 | 默认值           |
| --------------- | -------------------------------- | ------------------------------------ | ---------------- |
| `modelValue`    | 值，配合 `v-model`               | `string \| [string, string] \| null` | —                |
| `format`        | 是否带秒                         | `'HH:mm' \| 'HH:mm:ss'`              | `'HH:mm'`        |
| `displayFormat` | 显示格式，如 `hh:mm A`           | `string`                             | 语言包           |
| `range`         | 输入一段时间                     | `boolean`                            | `false`          |
| `hourStep`      | 小时段的步长                     | `number`                             | `1`              |
| `minuteStep`    | 分钟段的步长                     | `number`                             | `1`              |
| `secondStep`    | 秒段的步长                       | `number`                             | `1`              |
| `picker`        | 图标变成按钮，可以打开时间列     | `boolean`                            | `false`          |
| `clearable`     | 显示清空按钮                     | `boolean`                            | `false`          |
| `size`          | 尺寸，默认取表单或全局配置       | `'sm' \| 'md' \| 'lg'`               | `'md'`           |
| `disabled`      | 禁用                             | `boolean`                            | `false`          |
| `readonly`      | 只读，可以聚焦但不能修改         | `boolean`                            | `false`          |
| `invalid`       | 标记为无效                       | `boolean`                            | `false`          |
| `placement`     | 面板弹出的位置                   | `Placement`                          | `'bottom-start'` |
| `teleport`      | 面板渲染到哪里，`false` 留在原处 | `string \| HTMLElement \| false`     | `'body'`         |

### InputTime Events

| 名称                | 说明                               | 参数                                          |
| ------------------- | ---------------------------------- | --------------------------------------------- |
| `update:modelValue` | 值变化                             | `(value: string \| [string, string] \| null)` |
| `change`            | 用户输入、调整、选择或清空后值变化 | `(value: string \| [string, string] \| null)` |

### InputTime Exposes

| 名称    | 说明                           | 类型         |
| ------- | ------------------------------ | ------------ |
| `focus` | 聚焦第一个空的段，没有则第一段 | `() => void` |
| `blur`  | 移除焦点                       | `() => void` |
