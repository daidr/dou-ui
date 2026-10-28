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

样式同样可以按需引入：先引入 Token，再引入用到的组件样式。

```ts
import '@dou-ui/theme/tokens.css'
import '@dou-ui/theme/components/button.css'
```

## 开启主题

Token 默认挂在 `:root` 上。给任意元素加上 `data-dou-theme` 即可切换该子树的主题，并让它获得主题的背景色、文字色与字体：

```html
<html data-dou-theme="dark"></html>
```
