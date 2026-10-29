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
import 'dou-ui/components/select/style' // 选择器 + 浮层 + 标签 + 加载圈
```

只想手动挑样式表时，先引入 `core.css`，再引入组件样式：

```ts
import '@dou-ui/theme/core.css'
import '@dou-ui/theme/components/button.css'
```

## 自动导入

不想手写 `import` 时，Vite 应用可以用 `@dou-ui/resolver` 让模板里用到的组件连同样式自动导入，Nuxt 应用直接装 `@dou-ui/nuxt` 模块。详见 [Vite](/integrations/vite) 与 [Nuxt](/integrations/nuxt)。

## 开启主题

Token 默认挂在 `:root` 上。给任意元素加上 `data-dou-theme` 即可切换该子树的主题，并让它获得主题的背景色、文字色与字体：

```html
<html data-dou-theme="dark"></html>
```
