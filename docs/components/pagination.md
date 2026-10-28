# Pagination 分页

页码是幽灵按钮；当前页是一块凸起的表面——细描边加静止阴影，和分段控制器的选中块一致。数字等宽，翻页时整行宽度不变；页码的个数在每一页都相同，翻页时按钮不会在指针下面挪位置。

<script setup>
import { ref } from 'vue'
const page = ref(1)
const page2 = ref(6)
const pageSize = ref(20)
const page3 = ref(2)
</script>

## 基础用法

<div class="demo demo--column">
  <DouPagination v-model:page="page" :total="95" />
  <DouPagination v-model:page="page2" :total="500" />
</div>

```vue
<DouPagination v-model:page="page" :total="95" />
```

`siblings`（默认 1）是当前页两侧各显示几页，`boundaries`（默认 1）是首尾各固定显示几页，其余用省略号代替。

## 总数与每页条数

`show-total` 显示条目总数；传入 `page-sizes` 时显示每页条数的选择器。切换每页条数时会停在包含当前第一条的那一页。

<div class="demo demo--column">
  <DouPagination v-model:page="page2" v-model:page-size="pageSize" :total="500" show-total :page-sizes="[10, 20, 50, 100]" />
</div>

```vue
<DouPagination
  v-model:page="page"
  v-model:page-size="pageSize"
  :total="500"
  show-total
  :page-sizes="[10, 20, 50, 100]"
/>
```

## 简洁模式与尺寸

<div class="demo demo--column">
  <DouPagination v-model:page="page3" :total="95" simple />
  <DouPagination v-model:page="page3" :total="95" size="sm" />
  <DouPagination v-model:page="page3" :total="95" size="lg" />
  <DouPagination :page="2" :total="95" disabled />
</div>

## 读屏

外层是带 `aria-label` 的 `<nav>`；每个页码按钮的读屏名称是"第 n 页"，当前页带 `aria-current="page"`；上一页 / 下一页按钮在到头时禁用。省略号对读屏隐藏。所有文字都来自语言包。

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
| `simple`           | 只显示"当前 / 总页数"               | `boolean`              | `false` |
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
