# 快速开始

::: warning 早期阶段
DouUI 仍在搭建中，尚未发布到 npm，API 可能随时变化。
:::

## 安装

```sh
bun add dou-ui
```

## 全量注册

```ts
import { createApp } from 'vue'
import DouUI from 'dou-ui'
import 'dou-ui/style.css'
import App from './App.vue'

createApp(App).use(DouUI).mount('#app')
```

注册时可以传入应用级的默认配置，例如统一的尺寸与语言，详见 [全局配置](/components/config-provider)：

```ts
import DouUI, { en } from 'dou-ui'

app.use(DouUI, { size: 'sm', locale: en })
```

## 按需引入

组件可以单独导入，打包工具会摇掉没有用到的部分：

```vue
<script setup lang="ts">
import { DouButton } from 'dou-ui'
</script>

<template>
  <DouButton tone="primary">保存</DouButton>
</template>
```

样式同样可以按需引入。每个组件都有一个样式入口，里面是共用的基础样式（层级顺序、Token、基础层）加上这个组件以及它内部用到的组件的样式，按全量样式表里的顺序排好：

```ts
import 'dou-ui/components/select/style' // 选择器 + 浮层 + 标签
```

只想手动挑样式表时，先引入 `core.css`，再引入组件样式：

```ts
import '@dou-ui/theme/core.css'
import '@dou-ui/theme/components/button.css'
```

## 按需自动导入

`@dou-ui/resolver` 让模板里用到的组件自动导入，连同它的样式入口，不用再手写 `import`。配合按需组件插件 `unplugin-vue-components` 与自动导入插件 `unplugin-auto-import` 使用：

```sh
bun add -d @dou-ui/resolver unplugin-vue-components unplugin-auto-import
```

```ts
// vite.config.ts
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { DouUIApiResolver, DouUIResolver } from '@dou-ui/resolver'

export default defineConfig({
  plugins: [
    vue(),
    // toast()、dialog.confirm()、useDialog() 与 vLoading
    AutoImport({ resolvers: [DouUIApiResolver()] }),
    // <DouButton>、<DouSelect> 等组件，以及 v-loading 指令
    Components({ resolvers: [DouUIResolver()] }),
  ],
})
```

之后模板里直接写 `<DouButton>` 即可，打包结果只包含用到的组件和它们的样式。

| 选项          | 默认值  | 说明                                                                     |
| ------------- | ------- | ------------------------------------------------------------------------ |
| `importStyle` | `true`  | 同时导入组件的样式入口。已经全量引入 `dou-ui/style.css` 时设为 `false`   |
| `directives`  | `true`  | 解析 `v-loading`                                                         |
| `icons`       | `false` | 同时解析 `@dou-ui/icons` 的图标组件，如 `<SearchIcon />`（需要先安装它） |
| `exclude`     | —       | 不解析的名字：正则或名字列表，例如应用自己也定义了同名组件               |

`DouUIApiResolver` 接受 `importStyle` 与 `exclude` 两个选项。

## 开启主题

Token 默认挂在 `:root` 上。给任意元素加上 `data-dou-theme` 即可切换该子树的主题，并让它获得主题的背景色、文字色与字体：

```html
<html data-dou-theme="dark"></html>
```
