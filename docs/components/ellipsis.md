# Ellipsis 文本省略

超过指定行数的文字用省略号截断，可以展开查看全文，或者在悬停时显示完整内容。

只需要截断时，[Text](./text) 的 `truncate` 就够了；需要展开、提示或者判断是否被截断时使用 Ellipsis。

## 基础用法

`lines` 设置最多显示几行，默认一行。

<DocDemo src="ellipsis/basic" column />

## 展开与收起

`expandable` 在最后一行末尾放一个“展开”按钮，展开后变为“收起”。按钮只在文字确实被截断时出现，容器宽度变化时会重新判断。用 `v-model:expanded` 可以读取或控制展开状态，`toggle` 插槽可以替换按钮文字。

<DocDemo src="ellipsis/expandable" column />

## 悬停提示

`tooltip` 在文字被截断时用 [Tooltip](./tooltip) 显示完整内容，没有截断时不显示。适合文件名、路径这类单行文字。

<DocDemo src="ellipsis/tooltip" />

## API

### Props

| 名称               | 说明                                               | 类型        | 默认值  |
| ------------------ | -------------------------------------------------- | ----------- | ------- |
| `lines`            | 最多显示的行数                                     | `number`    | `1`     |
| `expandable`       | 显示展开 / 收起按钮                                | `boolean`   | `false` |
| `expanded`         | 是否展开，配合 `v-model:expanded`                  | `boolean`   | `false` |
| `tooltip`          | 截断时悬停显示完整内容；不与 `expandable` 同时生效 | `boolean`   | `false` |
| `tooltipPlacement` | 提示的位置                                         | `Placement` | `'top'` |
| `as`               | 渲染的元素                                         | `string`    | `'div'` |

### Events

| 名称              | 说明         | 参数                  |
| ----------------- | ------------ | --------------------- |
| `update:expanded` | 点击展开按钮 | `(expanded: boolean)` |

### Slots

| 名称      | 说明                              |
| --------- | --------------------------------- |
| `default` | 文字                              |
| `toggle`  | 替换按钮文字，参数 `{ expanded }` |
| `tooltip` | 替换提示内容，默认与文字相同      |

### Exposes

| 名称        | 说明                                             |
| ----------- | ------------------------------------------------ |
| `truncated` | 文字当前是否被截断（展开时为收起后是否会被截断） |
