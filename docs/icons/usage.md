<script setup>
import { CheckCircleIcon, DownloadIcon, LoaderIcon, PlusIcon, SearchIcon, TrashIcon } from 'dou-icons'
</script>

# 安装与使用

## 安装

```sh
bun add dou-icons
```

`dou-icons` 只依赖 `vue`（≥ 3.5），与 `dou-ui` 互不依赖，版本号保持同步。

## 按需引入

每个图标都是一个独立的 Vue 组件，命名为 `<名称的大驼峰>Icon`：`search` → `SearchIcon`，`arrow-up-right` → `ArrowUpRightIcon`。

```vue
<script setup lang="ts">
import { SearchIcon, TrashIcon } from 'dou-icons'
</script>

<template>
  <SearchIcon />
  <TrashIcon :size="20" />
</template>
```

包声明了 `sideEffects: false`，每个图标都在自己的模块里，打包工具只会保留真正用到的图标。

## 尺寸、线宽与颜色

<div class="demo">
  <DouText><SearchIcon /> 默认 1em，跟随字号</DouText>
  <SearchIcon :size="20" />
  <SearchIcon :size="24" />
  <SearchIcon :size="32" :stroke-width="1" />
  <DouText tone="success"><CheckCircleIcon :size="20" /></DouText>
  <DouText tone="danger"><TrashIcon :size="20" /></DouText>
</div>

```vue
<SearchIcon />
<SearchIcon :size="24" />
<SearchIcon :size="32" :stroke-width="1" />
```

- `size` 默认 `1em`，图标与周围文字一样大；数字按像素处理，也可以传任意 CSS 长度。
- `stroke-width` 以 16 网格为单位，默认 `1.5`。图标放大后线条随之按比例变粗，大尺寸展示时可以适当调细。
- 颜色总是 `currentColor`，用 `color` 或外层文字颜色控制。

## 搭配 DouUI

图标组件可以直接放进 `DouIcon` 的插槽，由 `DouIcon` 负责尺寸、旋转与读屏语义；也可以放进按钮、输入框等组件的图标插槽。

<div class="demo">
  <DouButton>
    <template #leading><DouIcon><PlusIcon /></DouIcon></template>
    新建
  </DouButton>
  <DouButton variant="outline">
    <template #leading><DouIcon><DownloadIcon /></DouIcon></template>
    下载
  </DouButton>
  <DouInput placeholder="搜索" style="width: 200px">
    <template #prefix><DouIcon><SearchIcon /></DouIcon></template>
  </DouInput>
  <DouIcon spin :size="18"><LoaderIcon /></DouIcon>
</div>

```vue
<DouButton>
  <template #leading>
    <DouIcon><PlusIcon /></DouIcon>
  </template>
  新建
</DouButton>

<DouIcon spin><LoaderIcon /></DouIcon>
```

## 无障碍

图标默认是装饰，带有 `aria-hidden="true"`。当图标是唯一的信息来源时（例如只有图标的按钮），传入 `label`，它会变成 `role="img"` 并带上可读名称。

```vue
<TrashIcon label="删除" />
```

## 元信息

`dou-icons/meta` 单独导出全部图标的元信息，适合做图标选择器、搜索等。它与图标组件分开，引入图标时不会带上这份数据。

```ts
import { categories, icons } from 'dou-icons/meta'

icons[0]
// {
//   name: 'alert-circle',
//   component: 'AlertCircleIcon',
//   label: '警示',
//   categories: ['status'],
//   variant: 'stroke',
// }

categories.status // '状态'
```

| 字段         | 说明                                     | 类型             |
| ------------ | ---------------------------------------- | ---------------- |
| `name`       | 短横线命名，也是 SVG 文件名              | `string`         |
| `component`  | 导出的组件名                             | `string`         |
| `label`      | 中文名，用于展示与搜索                   | `string`         |
| `categories` | 所属分类，至少一个                       | `IconCategory[]` |
| `variant`    | 变体。目前只有线性（`stroke`），后续扩展 | `'stroke'`       |

## SVG 文件

不使用 Vue 时，可以直接取用 SVG 源文件：

```ts
import searchUrl from 'dou-icons/svg/search.svg'
```

## 自定义图标

`createIcon` 把同一网格上的图形变成与内置图标行为一致的组件，适合补充项目里独有的图标：

```ts
import { createIcon } from 'dou-icons'

export const DotIcon = createIcon('dot', [['circle', { cx: 8, cy: 8, r: 2.5 }]])
```

## API

### Props

| 名称           | 说明                                   | 类型               | 默认值 |
| -------------- | -------------------------------------- | ------------------ | ------ |
| `size`         | 宽高，数字按像素处理                   | `number \| string` | `1em`  |
| `stroke-width` | 线宽，以 16 网格为单位                 | `number \| string` | `1.5`  |
| `label`        | 可读名称；不提供时图标对读屏软件不可见 | `string`           | —      |

`class`、`style` 与其他属性都会落到 `<svg>` 上。
