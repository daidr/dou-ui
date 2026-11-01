# Vite

`@dou-ui/resolver` 让模板里用到的组件自动导入，连同它的样式入口，不用再手写 `import`。它配合按需组件插件 `unplugin-vue-components` 与自动导入插件 `unplugin-auto-import` 使用。

能自动导入的有：

- `dou-ui` 的全部组件，以及 `v-loading`、`v-infinite-scroll` 两个指令；
- 生态系统各个包的组件，如 `<DouChart>`、`<DouEditor>`、`<DouGantt>`、`<DouSheet>`、`<DouFormRenderer>`；
- `@dou-ui/icons` 的图标组件，如 `<SearchIcon />`。

## 安装

```sh
bun add dou-ui
bun add -d @dou-ui/resolver unplugin-vue-components unplugin-auto-import
```

## 配置

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { DouUIApiResolver, DouUIResolver } from '@dou-ui/resolver'

export default defineConfig({
  plugins: [
    vue(),
    // toast()、dialog.confirm()、useDialog()、useColorMode() 等函数
    AutoImport({ resolvers: [DouUIApiResolver()] }),
    // <DouButton>、<DouSelect> 等组件，以及 v-loading 指令
    Components({ resolvers: [DouUIResolver()] }),
  ],
})
```

之后模板里直接写组件即可，不用 `import`，也不用引入样式表：

```vue
<script setup lang="ts">
const visits = [
  { month: '1月', users: 3820 },
  { month: '2月', users: 3410 },
  { month: '3月', users: 4260 },
]
</script>

<template>
  <DouButton tone="primary" @click="toast.success('已保存')">
    <template #leading><SearchIcon /></template>
    搜索
  </DouButton>
  <DouChart :data="visits" x="month">
    <DouChartLine y="users" name="月活跃用户" />
  </DouChart>
</template>
```

打包结果只包含用到的组件和它们的样式。上面的例子会生成这样的导入：

```ts
import { DouButton } from 'dou-ui'
import 'dou-ui/components/button/style'
import { DouChart, DouChartLine } from '@dou-ui/chart'
import '@dou-ui/chart/style'
import { SearchIcon } from '@dou-ui/icons'
import { toast } from 'dou-ui'
import 'dou-ui/components/toast/style'
```

## 生态系统的包

生态系统的包装好之后，它的组件同样可以直接写在模板里：

```sh
bun add @dou-ui/chart
```

每个包都有一个样式入口 `@dou-ui/<包名>/style`，里面是这个包自己的样式，加上它内部用到的 `dou-ui` 组件的样式，所以不需要再引入 `dou-ui/style.css`。同一个包的组件共用这一个入口。

有单独入口的组件从那个入口导入，例如 `<DouFormRenderer>` 从 `@dou-ui/form-builder/renderer` 导入，打包时不会带上设计器；`<DouScheduler>` 从 `@dou-ui/gantt/scheduler` 导入。

通过 `extensions`、`widgets` 等选项传入的扩展写在脚本里，仍然需要手动导入，它们用到的样式也按各自文档的说明引入，例如仪表盘的图表部件需要 `@dou-ui/chart/style.css`。

## 图标

安装了 `@dou-ui/icons` 时，图标组件会自动解析：

```sh
bun add @dou-ui/icons
```

应用自己的 `components` 目录里有同名组件时（例如 `SearchIcon.vue`），以应用的为准。也可以用 `icons: false` 关闭图标解析。

## 选项

`DouUIResolver` 的选项：

| 选项          | 默认值 | 说明                                                                                          |
| ------------- | ------ | --------------------------------------------------------------------------------------------- |
| `importStyle` | `true` | 同时导入组件的样式入口。已经全量引入 `dou-ui/style.css` 和各个包的 `style.css` 时设为 `false` |
| `directives`  | `true` | 解析 `v-loading` 与 `v-infinite-scroll`                                                       |
| `icons`       | 自动   | 解析 `@dou-ui/icons` 的图标组件，如 `<SearchIcon />`。默认在能找到 `@dou-ui/icons` 时开启     |
| `exclude`     | —      | 不解析的名字：正则或名字列表，例如应用自己也定义了同名组件                                    |

`DouUIApiResolver` 接受 `importStyle` 与 `exclude` 两个选项，能自动导入的函数有：

| 函数                          | 说明                                       |
| ----------------------------- | ------------------------------------------ |
| `toast`                       | [轻提示](/components/toast)                |
| `dialog`、`useDialog`         | [对话框](/components/dialog)               |
| `useColorMode`                | [配色模式](/components/color-mode)         |
| `useCountdown`                | [倒计时](/components/countdown)            |
| `useSortable`                 | [拖拽排序](/components/sortable)           |
| `vLoading`、`vInfiniteScroll` | 两个指令本身，用于 `withDirectives` 等场合 |
