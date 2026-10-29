# Breadcrumb 面包屑

显示当前页面在层级结构中的位置，可以点击返回上级页面。

<script setup>
import { ChevronRightIcon } from '@dou-ui/icons'
const items = [
  { label: '首页', href: '#' },
  { label: '项目', href: '#' },
  { label: 'dou-ui', href: '#' },
  { label: '部署', href: '#' },
  { label: '39dc86b' },
]
</script>

## 基础用法

<div class="demo">
  <DouBreadcrumb :items="items" />
</div>

```vue
<DouBreadcrumb
  :items="[
    { label: '首页', href: '/' },
    { label: '项目', href: '/projects' },
    { label: 'dou-ui', href: '/projects/dou-ui' },
    { label: '部署', href: '/projects/dou-ui/deployments' },
    { label: '39dc86b' },
  ]"
/>
```

最后一项是当前页，带 `aria-current="page"`。有 `href` 的项渲染为链接；没有 `href` 的项渲染为按钮，点击时触发 `navigate`，由使用者决定怎么跳转。

## 分隔符

<div class="demo demo--column">
  <DouBreadcrumb :items="items" separator="›" />
  <DouBreadcrumb :items="items">
    <template #separator>
      <ChevronRightIcon :size="14" />
    </template>
  </DouBreadcrumb>
</div>

## 折叠

路径太长时，`max-items` 只保留第一项和最后几项，中间折叠成一个省略号，点击后展开完整路径。

<div class="demo">
  <DouBreadcrumb :items="items" :max-items="3" />
</div>

## 配合路由

`item` 插槽替换每一项，参数为 `{ item, index, current }`，可以换成路由链接：

```vue
<DouBreadcrumb :items="items">
  <template #item="{ item, current }">
    <span v-if="current" aria-current="page">{{ item.label }}</span>
    <RouterLink v-else :to="item.href">{{ item.label }}</RouterLink>
  </template>
</DouBreadcrumb>
```

## 读屏

外层是带 `aria-label` 的 `<nav>`（文字来自语言包），里面是有序列表；分隔符对读屏隐藏。

## API

### Props

| 名称        | 说明                                   | 类型               | 默认值 |
| ----------- | -------------------------------------- | ------------------ | ------ |
| `items`     | 从根到当前页的路径，最后一项是当前页   | `BreadcrumbItem[]` | —      |
| `separator` | 分隔符文字                             | `string`           | `'/'`  |
| `maxItems`  | 最多显示几项，中间折叠为可展开的省略号 | `number`           | —      |

`BreadcrumbItem` 为 `{ label: string; href?: string; disabled?: boolean }`。

### Events

| 名称       | 说明                     | 参数                                                       |
| ---------- | ------------------------ | ---------------------------------------------------------- |
| `navigate` | 点击了当前页以外的某一项 | `(item: BreadcrumbItem, index: number, event: MouseEvent)` |

### Slots

| 名称        | 说明                                          |
| ----------- | --------------------------------------------- |
| `item`      | 替换每一项，参数为 `{ item, index, current }` |
| `separator` | 替换分隔符                                    |
