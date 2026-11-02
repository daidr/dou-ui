# Descriptions 描述列表

以列表形式展示多个字段，例如订单详情、用户资料。

## 基础用法

<DocDemo src="descriptions/basic" column />

`columns`（默认 3）决定一行放几项；`span` 让一项横跨几列，`span="fill"` 独占一整行。

## 水平布局

`layout="horizontal"` 把标签放在值的左边，标签宽度由 `labelWidth` 统一。

<DocDemo src="descriptions/horizontal" column />

## 带边框

<DocDemo src="descriptions/bordered" column />

## 语义

描述列表渲染为原生的 `<dl>`，每一项是包在 `<div>` 里的 `<dt>` 与 `<dd>`，读屏会把标签和值成对读出。

## API

### Descriptions Props

| 名称         | 说明                             | 类型                         | 默认值       |
| ------------ | -------------------------------- | ---------------------------- | ------------ |
| `title`      | 标题                             | `string`                     | —            |
| `columns`    | 一行几项                         | `number`                     | `3`          |
| `layout`     | 标签在值上方，还是左边           | `'vertical' \| 'horizontal'` | `'vertical'` |
| `bordered`   | 画成表格                         | `boolean`                    | `false`      |
| `labelWidth` | 水平布局下的标签宽度；数字为像素 | `string \| number`           | `96px`       |

### Descriptions Slots

| 名称      | 说明                  |
| --------- | --------------------- |
| `default` | `DouDescriptionsItem` |
| `title`   | 替换标题              |
| `extra`   | 头部末尾，如编辑按钮  |

### DescriptionsItem Props

| 名称    | 说明                        | 类型               | 默认值 |
| ------- | --------------------------- | ------------------ | ------ |
| `label` | 标签                        | `string`           | —      |
| `span`  | 横跨几列；`fill` 独占一整行 | `number \| 'fill'` | `1`    |

### DescriptionsItem Slots

| 名称      | 说明     |
| --------- | -------- |
| `default` | 值       |
| `label`   | 替换标签 |
