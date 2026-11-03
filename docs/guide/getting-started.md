# 快速开始

::: warning 早期阶段
DouUI 仍处于早期阶段，`1.0.0` 之前次版本号的变化可能包含不兼容的改动，升级前请看 [更新日志](https://github.com/daidr/dou-ui/releases)。
:::

## 安装

```sh
bun add dou-ui
```

想提前试用还没有正式发布的功能，可以安装测试版或预览版，详见 [版本与更新](./releases)。某个通道还没有发过版本时安装会报错，换用另一个即可：

```sh
bun add dou-ui@beta   # 测试版
bun add dou-ui@alpha  # 预览版
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

打开之后，组件上照样可以写这些属性：

- `aria-*` 和 `data-*` 可以写在任何组件上。`aria-*` 的名字和取值依旧受检，写成 `aria-lable` 会报错。
- 组件转交给元素的原生属性和事件，比如 DouInput 的 `placeholder`、`maxlength`、`@keydown`，DouButton 的 `form`、`autofocus`。与组件自己的 prop、事件同名时以组件的为准，例如 DouSelect 的 `change` 收到的是选中的值。按钮类组件不接受原生 `type`，DouButton 的按钮类型用 `nativeType`。
- 图标的根元素就是 `<svg>`，`id`、`role`、`focusable`、`@click` 等 SVG 属性和事件都能写。

```vue
<DouButton aria-label="关闭" data-testid="close" />
<DouInput
  v-model="city"
  placeholder="城市"
  maxlength="20"
  autocomplete="address-level2"
  @keydown.enter="search"
/>
```

普通元素上的 `data-*` 不在 Vue 的元素属性类型里，需要时在 `vueCompilerOptions` 里加上 `"dataAttributes": ["data-*"]`。
