# 字段类型

## 内置字段

每个内置字段对应 `dou-ui` 的一个组件，类型名就是组件名去掉 `Dou` 后的短横线写法，例如 `input-number` 渲染 `DouInputNumber`。`radio-group`、`checkbox-group`、`checkbox` 在组件外加了一层：前两个用 `options` 生成选项，`checkbox` 用 `text` 作为旁边的文字。节点的 `props` 原样传给组件，可用的设置见对应组件的文档；密码框就是 `input` 加上 `props: { type: 'password', showPassword: true }`。

| type                | 组件                                                   | 值                            | 空值                           |
| ------------------- | ------------------------------------------------------ | ----------------------------- | ------------------------------ |
| `input`             | [Input](/components/input)                             | 文字                          | `''`                           |
| `textarea`          | [Textarea](/components/textarea)                       | 文字                          | `''`                           |
| `input-number`      | [InputNumber](/components/input-number)                | 数字                          | `null`                         |
| `select`            | [Select](/components/select)                           | 选项的值，`multiple` 时是数组 | `null` / `[]`                  |
| `radio-group`       | [Radio](/components/radio)，选项来自 `options`         | 选项的值                      | `null`                         |
| `checkbox-group`    | [Checkbox](/components/checkbox)，选项来自 `options`   | 数组                          | `[]`                           |
| `checkbox`          | 单个 [Checkbox](/components/checkbox)，文字来自 `text` | 布尔值                        | `false`                        |
| `switch`            | [Switch](/components/switch)                           | 布尔值                        | `false`                        |
| `segmented-control` | [SegmentedControl](/components/segmented-control)      | 选项的值                      | 第一个选项                     |
| `slider`            | [Slider](/components/slider)                           | 数字，`range` 时是数组        | `min`，`range` 时 `[min, max]` |
| `rate`              | [Rate](/components/rate)                               | 数字                          | `0`                            |
| `date-picker`       | [DatePicker](/components/date-picker)                  | 日期字符串，`range` 时是数组  | `null`                         |
| `time-picker`       | [TimePicker](/components/time-picker)                  | 时间字符串                    | `null`                         |
| `color-picker`      | [ColorPicker](/components/color-picker)                | 颜色字符串                    | `null`                         |
| `cascader`          | [Cascader](/components/cascader)                       | 路径数组                      | `null`                         |
| `tree-select`       | [TreeSelect](/components/tree-select)，节点来自 `data` | 键，`multiple` 时是数组       | `null` / `[]`                  |
| `input-tag`         | [InputTag](/components/input-tag)                      | 字符串数组                    | `[]`                           |
| `input-otp`         | [InputOtp](/components/input-otp)                      | 文字                          | `''`                           |
| `upload`            | [Upload](/components/upload)                           | 文件列表                      | `[]`                           |

`radio-group`、`checkbox-group` 的 `options` 和 `select` 写法相同：字符串或数字既是值也是文字，也可以写 `{ value, label, disabled }`。`direction` 设为 `vertical` 时竖排。

只用来展示、不存值的字段：

| type      | 用途           | props                                                    |
| --------- | -------------- | -------------------------------------------------------- |
| `text`    | 标题或说明文字 | `content`，`variant`：`title`、`body`（默认）、`caption` |
| `divider` | 分割线         | `text`、`dashed`                                         |
| `alert`   | 提示条         | `content`、`title`、`tone`                               |

## 自定义字段

```ts
import { defineFormField } from '@dou-ui/form-builder'

const chips = defineFormField<{ options: string[] }>({
  type: 'chips',
  component: ChipField,
  defaultProps: { options: [] },
  empty: (props) => props.options[0] ?? null,
})
```

```vue
<DouFormRenderer :form="form" :fields="[chips]" />
```

| 名称                            | 说明                                                                                                        |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `type`                          | 节点里 `type` 用的名字。和内置类型同名时替换内置的                                                          |
| `label`                         | 给搭建表单的人看的名称                                                                                      |
| `kind`                          | `value`（默认）：存值，套上带标签、提示和校验的表单项；`display`：只展示                                    |
| `component`                     | 渲染字段的组件，拿到 `modelValue` 和设置作为属性，触发 `update:modelValue`                                  |
| `defaultProps`                  | 设置的默认值，节点的 `props` 覆盖在上面                                                                     |
| `empty(props)`                  | 类型的空值，节点没有 `default` 时字段从它开始，默认 `null`                                                  |
| `toProps(props, node)`          | 设置和组件属性不一致时，在这里转换成组件属性                                                                |
| `optionsProp`                   | 接收选项的属性名，如 `options`。设置后节点可以用 `source` 加载选项，见[联动与表达式](./logic#选项来源)      |
| `fitValue(value, options)`      | 选项变化后把旧值收窄到新选项提供的范围，见[联动与表达式](./logic#选项来源)                                  |
| `format(value, props, context)` | 只读时显示的文字，见下文                                                                                    |
| `readonlyComponent`             | 只读时代替文字显示值的组件，拿到 `modelValue` 和与 `component` 相同的属性，组件声明了 `readonly` 时也会传入 |

字段组件里调用 `useFormField()`，可以拿到正在渲染的 `node`、它的 `type` 和合并后的 `props`。字段组件不需要自己处理标签和错误信息，外层的表单项会处理；组件里的可聚焦元素会自动和标签关联（`dou-ui` 的输入控件都是这样做的，自己写的控件可以用 `useFormItem()` 拿到 `inputId`）。

### 只读时的显示

渲染器 `readonly` 时，字段的值显示成文字。空值（`null`、空文字、空数组）直接显示“—”，不会交给 `format`。其余的值：

- 类型有 `format(value, props, context)` 时用它返回的文字。`props` 是合并后的设置，从来源加载的选项也已经放进去了；`context` 有 `node`、渲染器的文字 `messages`（如 `yes`、`no`、列表分隔符 `separator`）和 `dou-ui` 当前的 `locale`。
- 没有 `format` 但有 `optionsProp` 时，显示选中选项的文字。
- 都没有时显示值本身：列表用分隔符连起来，`true` / `false` 显示“是”“否”。`formatValue(value, context)` 就是这个默认的做法，自己的 `format` 处理不了的值可以交给它。

```ts
const money = defineFormField({
  type: 'money',
  component: MoneyInput,
  format: (value) => `¥${Number(value).toFixed(2)}`,
})
```

内置类型里，`rate` 只读时仍然显示星星，`color-picker` 显示色块和色值，`upload` 显示文件名，有 `url` 的文件名可以点开。
