# InputNumber 数字输入

输入数字，可以设置范围和步长。

## 基础用法

<DocDemo src="input-number/basic" />

加减两个步进键上下叠放在输入框末端，各占一半高度。清空输入框得到 `null`。到达 `min` 或 `max` 时，对应的步进键会变为禁用。

## 步长与精度

`step` 决定每次步进的量，小数步进不会出现浮点误差（`0.1 + 0.2` 得到 `0.3`）。`precision` 指定保留的小数位，输入和显示都会按它取整。

<DocDemo src="input-number/step-precision" />

## 前缀与后缀

<DocDemo src="input-number/prefix-suffix" />

前缀或后缀里也可以放 [Button](./button) 或 [CopyButton](./copy-button)，和 [Input](./input#前缀与后缀) 一样由输入框决定按钮的高度和留白，并随输入框一起禁用。显示步进键时，后缀不在最右侧，右侧的内边距不变。

`controls` 设为 `false` 时隐藏步进键，键盘步进仍然可用。

## 显示格式

`format` 决定不在编辑时数字怎么显示，比如加千位分隔符、显示为货币或百分比。它可以是 `Intl.NumberFormat` 的选项（按当前语言包的语言格式化），也可以是一个函数。聚焦后输入框显示原始数字，方便修改；`v-model` 始终是数字。

设置了 `precision` 时，小数位默认与它一致。百分比格式会把 `0.25` 显示为 `25%`，所以绑定值是小数。

<DocDemo src="input-number/format" />

## 清空

`clearable` 在有值时显示清空按钮，点击后值变为 `null` 并触发 `clear`。

## 输入与提交

- 输入过程中，只要文字已经是一个范围内的数字，就会立刻更新 `v-model`；像 `-`、`1.` 这样尚未完成的输入会被保留，不会被打断。
- 失焦或按下 `Enter` 时提交：超出范围的值收回到 `min` / `max`，按 `precision` 取整，无法识别的文字恢复为之前的值。提交时若值有变化，触发 `change`。
- 输入法产生的全角数字和符号（如 `１２．５`）也能识别。
- 手机上弹出的键盘：`precision` 为 `0` 时是纯数字键盘，其他情况是带小数点的数字键盘。iOS 的数字键盘没有负号，所以设置了小于 0 的 `min` 时改用完整键盘。没有设置 `min` 时仍用数字键盘，因为大多数数字不会是负数；需要在 iOS 上输入负数时，设置小于 0 的 `min`，或者传 `inputmode="text"`。

## 键盘与指针

| 操作                  | 行为                     |
| --------------------- | ------------------------ |
| `↑` / `↓`             | 增加 / 减少一个步长      |
| `PageUp` / `PageDown` | 增加 / 减少十个步长      |
| `Home` / `End`        | 跳到 `min` / `max`       |
| `Enter`               | 提交当前输入             |
| 按住步进键            | 先停顿片刻，然后连续步进 |

## 触摸操作

步进键对手指来说太小，所以触摸时按下的第一下不会步进，而是把两个键放大成输入框末端上方的按键面板：

- 手指按下后不松开，向上滑到加键或向下滑到减键，会立刻步进一次，停留时继续连续步进；滑回中间即停止。以这种方式调整时，松手后面板立即收回。
- 面板放大后，再点按加键或减键就正常步进，按住同样连续步进。
- 只按下没有滑动时，面板保持放大；点击面板以外的任何地方，或静置 2 秒没有操作，面板会收回原来的大小。

面板的尺寸不随 `size` 变化，按键保持适合手指的大小。鼠标和触控笔不触发放大，直接步进。

输入框带有 `role="spinbutton"` 与 `aria-valuenow`、`aria-valuemin`、`aria-valuemax`。步进键不进入 Tab 顺序（键盘直接用方向键），它们的读屏标签来自 [全局配置](./config-provider) 的语言包。

## 尺寸与状态

<DocDemo src="input-number/size-state" column />

默认宽度为 `160px`，可以用 `style` 或 `class` 覆盖。

## API

### Props

| 名称          | 说明                                                   | 类型                                                      | 默认值      |
| ------------- | ------------------------------------------------------ | --------------------------------------------------------- | ----------- |
| `modelValue`  | 绑定值，配合 `v-model`，为空时 `null`                  | `number \| null`                                          | `null`      |
| `min`         | 最小值                                                 | `number`                                                  | `-Infinity` |
| `max`         | 最大值                                                 | `number`                                                  | `Infinity`  |
| `step`        | 步长                                                   | `number`                                                  | `1`         |
| `precision`   | 保留的小数位                                           | `number`                                                  | —           |
| `size`        | 尺寸，默认取表单或全局配置                             | `'sm' \| 'md' \| 'lg'`                                    | `'md'`      |
| `controls`    | 显示步进键                                             | `boolean`                                                 | `true`      |
| `format`      | 不在编辑时的显示格式：`Intl.NumberFormat` 的选项或函数 | `Intl.NumberFormatOptions \| ((value: number) => string)` | —           |
| `clearable`   | 有值时显示清空按钮                                     | `boolean`                                                 | `false`     |
| `placeholder` | 占位文字                                               | `string`                                                  | —           |
| `disabled`    | 禁用                                                   | `boolean`                                                 | `false`     |
| `readonly`    | 只读，不能输入也不能步进                               | `boolean`                                                 | `false`     |
| `invalid`     | 标记为无效                                             | `boolean`                                                 | `false`     |

其他属性（`placeholder`、`name` 等）透传给原生 `<input>`。

### Events

| 名称                | 说明                                   | 参数                                                |
| ------------------- | -------------------------------------- | --------------------------------------------------- |
| `update:modelValue` | 值变化，输入过程中也会触发             | `(value: number \| null)`                           |
| `change`            | 提交了新的值：失焦、`Enter` 或一次步进 | `(value: number \| null, oldValue: number \| null)` |
| `clear`             | 点击清空按钮后                         | `()`                                                |

### Slots

| 名称     | 说明                     |
| -------- | ------------------------ |
| `prefix` | 数字前的内容，如货币符号 |
| `suffix` | 数字后的内容，如单位     |

### Exposes

| 名称       | 说明           | 类型                       |
| ---------- | -------------- | -------------------------- |
| `input`    | 原生输入元素   | `HTMLInputElement \| null` |
| `focus`    | 聚焦           | `() => void`               |
| `blur`     | 失焦           | `() => void`               |
| `increase` | 增加若干个步长 | `(count?: number) => void` |
| `decrease` | 减少若干个步长 | `(count?: number) => void` |

### CSS 变量

| 变量                              | 说明                                 |
| --------------------------------- | ------------------------------------ |
| `--dou-input-number-height`       | 高度                                 |
| `--dou-input-number-padding-x`    | 水平内边距                           |
| `--dou-input-number-step-width`   | 步进键宽度                           |
| `--dou-input-number-icon-size`    | 步进键图标尺寸                       |
| `--dou-input-number-action-inset` | 前缀、后缀里的按钮与输入框内沿的距离 |
| `--dou-input-number-bg`           | 背景色                               |
| `--dou-input-number-border`       | 描边颜色                             |
| `--dou-input-number-border-focus` | 聚焦描边颜色                         |
| `--dou-input-number-ring`         | 聚焦光晕颜色                         |
