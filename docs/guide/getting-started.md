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

没有设置 `data-dou-theme` 时使用亮色主题，DouUI 会在 `:root` 上声明 `color-scheme: light`。因此页面里的 `<meta name="color-scheme" content="light dark">` 不再生效：想跟随系统切换亮色和暗色，请用 [`useColorMode()`](/components/color-mode)，它会替你维护 `data-dou-theme`。页面样式表里自己写的 `color-scheme` 会覆盖这条声明，但 Token 不会随之改变，所以切换暗色请用 `data-dou-theme`，不要只改 `color-scheme`。

## 浏览器要求

发布的样式直接使用 `light-dark()` 和原生 CSS 嵌套，要求以下版本起的浏览器：

| 浏览器              | 最低版本 |
| ------------------- | -------- |
| Chrome / Edge       | 123      |
| Firefox             | 120      |
| Safari / iOS Safari | 17.5     |

需要支持更旧的浏览器时，调低打包工具的构建目标即可（例如 Vite 的 `build.cssTarget`），它会把这些写法改写成旧浏览器能识别的形式，改写后亮色和暗色主题仍然正确。

## 类型检查

组件的 props、事件和插槽都有类型。不过 Vue 默认把没有声明的属性当作普通 HTML 属性透传给根元素，所以 prop 名写错了（比如把 `tone` 写成 `type`）不会报错，只是悄悄不生效。建议在应用的 `tsconfig.json` 里打开下面两个选项，让 `vue-tsc` 和编辑器指出写错的 prop 和事件：

```json
{
  "vueCompilerOptions": {
    "checkUnknownProps": true,
    "checkUnknownEvents": true
  }
}
```
