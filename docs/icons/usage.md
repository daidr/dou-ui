# 安装与使用

## 安装

```sh
bun add @dou-ui/icons
```

`@dou-ui/icons` 只依赖 `vue`（≥ 3.5），与 `dou-ui` 互不依赖，版本号保持同步。

## 按需引入

每个图标都是一个独立的 Vue 组件，命名为 `<名称的大驼峰>Icon`：`search` → `SearchIcon`，`arrow-up-right` → `ArrowUpRightIcon`。

```vue
<script setup lang="ts">
import { SearchIcon, TrashIcon } from '@dou-ui/icons'
</script>

<template>
  <SearchIcon />
  <TrashIcon :size="20" />
</template>
```

包声明了 `sideEffects: false`，每个图标都在自己的模块里，打包工具只会保留真正用到的图标。

## 尺寸、线宽与颜色

<DocDemo src="icons-usage/size-color" />

- `size` 默认 `1em`，图标与周围文字一样大；数字按像素处理，也可以传任意 CSS 长度。
- 线宽默认随尺寸做光学补偿：16px 时 1.25px，24px 时 1.5px，48px 时 2.25px（`0.75px + 尺寸 / 32`）。传入 `stroke-width` 则固定为该像素值。补偿按图标的字号计算，放在 `DouIcon` 里时会自动使用 `DouIcon` 的尺寸。
- 颜色总是 `currentColor`，用 `color` 或外层文字颜色控制。

## 搭配 DouUI

图标组件可以直接放进 `DouIcon` 的插槽，由 `DouIcon` 负责尺寸、旋转与读屏语义；也可以放进按钮、输入框等组件的图标插槽。

<DocDemo src="icons-usage/with-dou-ui" />

## 无障碍

图标默认是装饰，带有 `aria-hidden="true"`。当图标是唯一的信息来源时（例如只有图标的按钮），传入 `label`，它会变成 `role="img"` 并带上可读名称。

```vue
<TrashIcon label="删除" />
```

## 元信息

`@dou-ui/icons/meta` 单独导出全部图标的元信息，适合做图标选择器、搜索等。它与图标组件分开，引入图标时不会带上这份数据。

```ts
import { categories, icons } from '@dou-ui/icons/meta'

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

不使用 Vue 时，可以直接取用 SVG 源文件。作为图片使用时线宽会随尺寸缩放（24px 时为 1.5px）：

```ts
import searchUrl from '@dou-ui/icons/svg/search.svg'
```

## 自定义图标

`createIcon` 把 24 网格上的图形变成与内置图标行为一致的组件（线宽补偿、无障碍语义），适合补充项目里独有的图标。`['dot', { cx, cy }]` 画一个比线略重的点：

```ts
import { createIcon } from '@dou-ui/icons'

export const TargetIcon = createIcon('target', [
  ['circle', { cx: 12, cy: 12, r: 9 }],
  ['dot', { cx: 12, cy: 12 }],
])
```

## API

### Props

| 名称           | 说明                                   | 类型               | 默认值 |
| -------------- | -------------------------------------- | ------------------ | ------ |
| `size`         | 宽高，数字按像素处理                   | `number \| string` | `1em`  |
| `stroke-width` | 固定线宽，数字按像素处理               | `number \| string` | 随尺寸 |
| `label`        | 可读名称；不提供时图标对读屏软件不可见 | `string`           | —      |

`class`、`style` 与其他属性都会落到 `<svg>` 上。
