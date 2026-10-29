# PageHeader 页头

页面最上方的一行：可选的面包屑，一个安静的返回链接，一道细竖线，然后是标题、副标题，末尾放操作。页头没有自己的底色和描边，落在什么页面上就是什么页面。

<script setup>
import { ref } from 'vue'
const backs = ref(0)
</script>

## 基础用法

<div class="demo demo--column">
  <DouPageHeader title="订单详情" subtitle="SH-20261029-0042" @back="backs++" />
  <DouText size="sm" variant="tertiary">点了 {{ backs }} 次返回</DouText>
</div>

```vue
<DouPageHeader title="订单详情" subtitle="SH-20261029-0042" @back="router.back()" />
```

组件只发出 `back`，回到哪里由你决定：`router.back()`、跳到列表页，或者先确认有没有未保存的修改。`back-text` 改按钮文字，`icon` 插槽换掉箭头，`:show-back="false"` 去掉返回按钮。

## 面包屑、操作与内容

`breadcrumb` 插槽在标题行上方，`extra` 插槽在标题行末尾，默认插槽在标题行下方，可以放说明、描述列表或一排统计数值。

<div class="demo demo--column">
  <DouPageHeader title="上海研发中心" subtitle="进行中" style="width: 100%">
    <template #breadcrumb>
      <DouBreadcrumb :items="[{ label: '首页', href: '#' }, { label: '项目', href: '#' }, { label: '上海研发中心' }]" />
    </template>
    <template #extra>
      <DouButton variant="outline" size="sm">编辑</DouButton>
      <DouButton variant="solid" size="sm">发布</DouButton>
    </template>
    园区二期的装修与搬迁，预计 12 月完成。
  </DouPageHeader>
</div>

```vue
<DouPageHeader title="上海研发中心" subtitle="进行中">
  <template #breadcrumb><DouBreadcrumb :items="items" /></template>
  <template #extra>
    <DouButton variant="outline" size="sm">编辑</DouButton>
    <DouButton variant="solid" size="sm">发布</DouButton>
  </template>
  园区二期的装修与搬迁，预计 12 月完成。
</DouPageHeader>
```

## 读屏

根节点是 `<header>`，标题默认是 `<h1>`；页头放在页面里更深的位置时，用 `level` 调成合适的标题级别，让页面的标题大纲保持连贯。返回按钮是普通的 `<button>`，文字就是它的名字；箭头只是装饰。

## API

### Props

| 名称       | 说明         | 类型                         | 默认值   |
| ---------- | ------------ | ---------------------------- | -------- |
| `title`    | 标题         | `string`                     | —        |
| `subtitle` | 副标题       | `string`                     | —        |
| `showBack` | 显示返回按钮 | `boolean`                    | `true`   |
| `backText` | 返回按钮文字 | `string`                     | `'返回'` |
| `level`    | 标题的级别   | `1 \| 2 \| 3 \| 4 \| 5 \| 6` | `1`      |

### Events

| 名称   | 说明           | 参数                  |
| ------ | -------------- | --------------------- |
| `back` | 点击了返回按钮 | `(event: MouseEvent)` |

### Slots

| 名称         | 说明                     |
| ------------ | ------------------------ |
| `breadcrumb` | 标题行上方，通常是面包屑 |
| `icon`       | 替换返回箭头             |
| `title`      | 替换标题                 |
| `subtitle`   | 替换副标题               |
| `extra`      | 标题行末尾的操作         |
| `default`    | 标题行下方的内容         |
