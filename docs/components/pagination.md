# Pagination 分页

数据较多时分页展示。

## 基础用法

<DocDemo src="pagination/basic" column />

`siblings`（默认 1）是当前页两侧各显示几页，`boundaries`（默认 1）是首尾各固定显示几页，其余用省略号代替。

## 总数与每页条数

`show-total` 显示条目总数；传入 `page-sizes` 时显示每页条数的选择器。切换每页条数时会停在包含当前第一条的那一页。

<DocDemo src="pagination/total-sizes" column />

## 简洁模式与尺寸

<DocDemo src="pagination/simple" column />

## 读屏

外层是带 `aria-label` 的 `<nav>`；每个页码按钮的读屏名称是“第 n 页”，当前页带 `aria-current="page"`；上一页 / 下一页按钮在到头时禁用。省略号对读屏隐藏。所有文字都来自语言包。

## API

### Props

| 名称               | 说明                                | 类型                   | 默认值  |
| ------------------ | ----------------------------------- | ---------------------- | ------- |
| `page`             | 当前页（从 1 开始），`v-model:page` | `number`               | `1`     |
| `pageSize`         | 每页条数，`v-model:page-size`       | `number`               | `10`    |
| `total`            | 条目总数                            | `number`               | —       |
| `pageSizes`        | 可选的每页条数；不传不显示选择器    | `number[]`             | —       |
| `siblings`         | 当前页两侧各显示几页                | `number`               | `1`     |
| `boundaries`       | 首尾各固定显示几页                  | `number`               | `1`     |
| `simple`           | 只显示“当前 / 总页数”               | `boolean`              | `false` |
| `showTotal`        | 显示条目总数                        | `boolean`              | `false` |
| `hideOnSinglePage` | 只有一页时不渲染                    | `boolean`              | `false` |
| `disabled`         | 禁用                                | `boolean`              | `false` |
| `size`             | 尺寸，默认取表单或全局配置          | `'sm' \| 'md' \| 'lg'` | `'md'`  |

### Events

| 名称              | 说明               | 参数                               |
| ----------------- | ------------------ | ---------------------------------- |
| `update:page`     | 页码变化           | `(page: number)`                   |
| `update:pageSize` | 每页条数变化       | `(pageSize: number)`               |
| `change`          | 页码或每页条数变化 | `(page: number, pageSize: number)` |

### 工具函数

`paginationRange(current, count, siblings, boundaries)` 返回要显示的页码与省略号，自己画分页时可以复用同样的规则。
