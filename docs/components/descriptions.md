# Descriptions 描述列表

以列表形式展示多个字段，例如订单详情、用户资料。

## 基础用法

<div class="demo demo--column">
  <DouDescriptions title="实例">
    <template #extra><DouButton variant="outline" size="sm">编辑</DouButton></template>
    <DouDescriptionsItem label="名称">edge-fn-sh</DouDescriptionsItem>
    <DouDescriptionsItem label="区域">上海</DouDescriptionsItem>
    <DouDescriptionsItem label="状态"><DouTag tone="success" size="sm" round>运行中</DouTag></DouDescriptionsItem>
    <DouDescriptionsItem label="规格">2 vCPU · 512 MB</DouDescriptionsItem>
    <DouDescriptionsItem label="创建于">2026-10-28 14:32</DouDescriptionsItem>
    <DouDescriptionsItem label="副本">3</DouDescriptionsItem>
    <DouDescriptionsItem label="说明" span="fill">自动扩缩容的边缘函数，部署在离用户最近的节点。</DouDescriptionsItem>
  </DouDescriptions>
</div>

```vue
<DouDescriptions title="实例">
  <template #extra><DouButton variant="outline" size="sm">编辑</DouButton></template>
  <DouDescriptionsItem label="名称">edge-fn-sh</DouDescriptionsItem>
  <DouDescriptionsItem label="区域">上海</DouDescriptionsItem>
  <DouDescriptionsItem label="说明" span="fill">…</DouDescriptionsItem>
</DouDescriptions>
```

`columns`（默认 3）决定一行放几项；`span` 让一项横跨几列，`span="fill"` 独占一整行。

## 水平布局

`layout="horizontal"` 把标签放在值的左边，标签宽度由 `label-width` 统一。

<div class="demo demo--column">
  <DouDescriptions layout="horizontal" :columns="2" :label-width="72">
    <DouDescriptionsItem label="分支">main</DouDescriptionsItem>
    <DouDescriptionsItem label="提交">39dc86b</DouDescriptionsItem>
    <DouDescriptionsItem label="作者">daidr</DouDescriptionsItem>
    <DouDescriptionsItem label="耗时">42 秒</DouDescriptionsItem>
  </DouDescriptions>
</div>

## 带边框

<div class="demo demo--column">
  <DouDescriptions bordered :columns="3">
    <DouDescriptionsItem label="名称">edge-fn-sh</DouDescriptionsItem>
    <DouDescriptionsItem label="区域">上海</DouDescriptionsItem>
    <DouDescriptionsItem label="副本">3</DouDescriptionsItem>
    <DouDescriptionsItem label="说明" span="fill">自动扩缩容的边缘函数，部署在离用户最近的节点。</DouDescriptionsItem>
  </DouDescriptions>
  <DouDescriptions bordered layout="horizontal" :columns="2">
    <DouDescriptionsItem label="分支">main</DouDescriptionsItem>
    <DouDescriptionsItem label="提交">39dc86b</DouDescriptionsItem>
    <DouDescriptionsItem label="作者">daidr</DouDescriptionsItem>
    <DouDescriptionsItem label="耗时">42 秒</DouDescriptionsItem>
  </DouDescriptions>
</div>

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
