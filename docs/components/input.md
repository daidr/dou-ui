# Input 输入框

单行文本输入框。

## 基础用法

<DocDemo src="input/basic" />

所有未声明为 prop 的属性（`placeholder`、`name`、`autocomplete`、`maxlength`、事件监听等）都会透传给原生 `<input>`；`class` 与 `style` 则作用于外层的输入框表面。

## 尺寸

与按钮共享控件高度 Token，同尺寸的输入框和按钮总是对齐的。

<DocDemo src="input/size" column />

## 前缀与后缀

<DocDemo src="input/prefix-suffix" />

## 可清空

`clearable` 在有内容且可编辑时显示清空按钮；清空后焦点回到输入框，并触发 `clear`。清空按钮的读屏标签来自 [全局配置](./config-provider) 的语言包。

## 密码

`type="password"` 加上 `showPassword`，末尾多一个眼睛按钮，切换明文与密文。按钮是 `aria-pressed` 的开关，读屏标签随状态在“显示密码”和“隐藏密码”之间切换。

<DocDemo src="input/password" />

## 字数统计

`showCount` 在末尾显示已输入的字数；同时设了原生 `maxlength` 时显示为“已输入 / 上限”。一个 emoji 算一个字。

<DocDemo src="input/word-count" />

## 状态

<DocDemo src="input/status" column style="max-width: 280px" />

`invalid` 会设置 `aria-invalid`，描边与聚焦光晕切换为危险语气。放在 [表单项](./form) 中时，校验失败会自动进入无效状态，并关联标签与错误信息。

## API

### Props

| 名称           | 说明                                | 类型                                                                        | 默认值   |
| -------------- | ----------------------------------- | --------------------------------------------------------------------------- | -------- |
| `modelValue`   | 绑定值，配合 `v-model`              | `string`                                                                    | `''`     |
| `size`         | 尺寸，默认取表单或全局配置          | `'sm' \| 'md' \| 'lg'`                                                      | `'md'`   |
| `type`         | 原生 `type`                         | `'text' \| 'password' \| 'email' \| 'url' \| 'tel' \| 'search' \| 'number'` | `'text'` |
| `disabled`     | 禁用                                | `boolean`                                                                   | `false`  |
| `readonly`     | 只读                                | `boolean`                                                                   | `false`  |
| `invalid`      | 标记为无效                          | `boolean`                                                                   | `false`  |
| `clearable`    | 有内容时显示清空按钮                | `boolean`                                                                   | `false`  |
| `showPassword` | 密码框显示明文切换按钮              | `boolean`                                                                   | `false`  |
| `showCount`    | 显示字数，有 `maxlength` 时显示上限 | `boolean`                                                                   | `false`  |

### Events

| 名称                | 说明         | 参数              |
| ------------------- | ------------ | ----------------- |
| `update:modelValue` | 值变化       | `(value: string)` |
| `clear`             | 点击清空按钮 | —                 |

原生事件（`focus`、`blur`、`keydown` 等）直接监听即可，它们会落在原生 `<input>` 上。

### Slots

| 名称     | 说明                       |
| -------- | -------------------------- |
| `prefix` | 文字前的内容，通常是图标   |
| `suffix` | 文字后的内容，如单位或图标 |

### Exposes

| 名称     | 说明         | 类型                       |
| -------- | ------------ | -------------------------- |
| `input`  | 原生输入元素 | `HTMLInputElement \| null` |
| `focus`  | 聚焦         | `() => void`               |
| `blur`   | 失焦         | `() => void`               |
| `select` | 选中全部文字 | `() => void`               |

### CSS 变量

| 变量                       | 说明         |
| -------------------------- | ------------ |
| `--dou-input-height`       | 高度         |
| `--dou-input-padding-x`    | 水平内边距   |
| `--dou-input-radius`       | 圆角         |
| `--dou-input-bg`           | 背景色       |
| `--dou-input-border`       | 描边颜色     |
| `--dou-input-border-focus` | 聚焦描边颜色 |
| `--dou-input-ring`         | 聚焦光晕颜色 |
