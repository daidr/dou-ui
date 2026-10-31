# 字段类型

## 内置字段

每个内置字段对应 `dou-ui` 的一个组件，节点的 `props` 原样传给它，可用的设置见对应组件的文档。

| type             | 组件                                                   | 值                            | 空值                           |
| ---------------- | ------------------------------------------------------ | ----------------------------- | ------------------------------ |
| `input`          | [Input](/components/input)                             | 文字                          | `''`                           |
| `textarea`       | [Textarea](/components/textarea)                       | 文字                          | `''`                           |
| `password`       | [Input](/components/input)，`type: 'password'`         | 文字                          | `''`                           |
| `number`         | [InputNumber](/components/input-number)                | 数字                          | `null`                         |
| `select`         | [Select](/components/select)                           | 选项的值，`multiple` 时是数组 | `null` / `[]`                  |
| `radio-group`    | [Radio](/components/radio)，选项来自 `options`         | 选项的值                      | `null`                         |
| `checkbox-group` | [Checkbox](/components/checkbox)，选项来自 `options`   | 数组                          | `[]`                           |
| `checkbox`       | 单个 [Checkbox](/components/checkbox)，文字来自 `text` | 布尔值                        | `false`                        |
| `switch`         | [Switch](/components/switch)                           | 布尔值                        | `false`                        |
| `segmented`      | [SegmentedControl](/components/segmented-control)      | 选项的值                      | 第一个选项                     |
| `slider`         | [Slider](/components/slider)                           | 数字，`range` 时是数组        | `min`，`range` 时 `[min, max]` |
| `rate`           | [Rate](/components/rate)                               | 数字                          | `0`                            |
| `date`           | [DatePicker](/components/date-picker)                  | 日期字符串，`range` 时是数组  | `null`                         |
| `time`           | [TimePicker](/components/time-picker)                  | 时间字符串                    | `null`                         |
| `color`          | [ColorPicker](/components/color-picker)                | 颜色字符串                    | `null`                         |
| `cascader`       | [Cascader](/components/cascader)                       | 路径数组                      | `null`                         |
| `tree-select`    | [TreeSelect](/components/tree-select)，节点来自 `data` | 键，`multiple` 时是数组       | `null` / `[]`                  |
| `tags`           | [InputTag](/components/input-tag)                      | 字符串数组                    | `[]`                           |
| `otp`            | [InputOtp](/components/input-otp)                      | 文字                          | `''`                           |
| `upload`         | [Upload](/components/upload)                           | 文件列表                      | `[]`                           |

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
  defaults: { options: [] },
  initial: (props) => props.options[0] ?? null,
})
```

```vue
<DouFormRenderer :document="document" :fields="[chips]" />
```

| 名称                | 说明                                                                       |
| ------------------- | -------------------------------------------------------------------------- |
| `type`              | 节点里 `type` 用的名字。和内置类型同名时替换内置的                         |
| `label`             | 给搭建表单的人看的名称                                                     |
| `kind`              | `value`（默认）：存值，套上带标签、提示和校验的表单项；`display`：只展示   |
| `component`         | 渲染字段的组件，拿到 `modelValue` 和设置作为属性，触发 `update:modelValue` |
| `defaults`          | 设置的默认值，节点的 `props` 覆盖在上面                                    |
| `initial(props)`    | 节点没有 `default` 时的初始值，默认 `null`                                 |
| `bind(props, node)` | 设置和组件属性不一致时，在这里转换                                         |

字段组件里调用 `useFormField()`，可以拿到正在渲染的 `node`、它的 `type` 和合并后的 `props`。字段组件不需要自己处理标签和错误信息，外层的表单项会处理；组件里的可聚焦元素会自动和标签关联（`dou-ui` 的输入控件都是这样做的，自己写的控件可以用 `useFormItem()` 拿到 `inputId`）。
