# Nuxt

`@dou-ui/nuxt` 是 DouUI 的 Nuxt 模块。装上之后，组件、指令和常用函数都能直接使用，样式和配色模式也一并处理好，服务端渲染开箱即用。需要 Nuxt 4。

## 安装

```sh
bun add dou-ui @dou-ui/nuxt
```

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@dou-ui/nuxt'],
})
```

之后页面里直接写组件即可，不用 `import`：

```vue
<script setup lang="ts">
const name = ref('')

function save() {
  toast.success('已保存')
}
</script>

<template>
  <DouInput v-model="name" placeholder="戴兜" />
  <DouButton tone="primary" @click="save">保存</DouButton>
</template>
```

模块做了这些事：

- **组件**：`dou-ui` 的全部组件（`<DouButton>`、`<DouSelect>` 等）都能在模板里直接用，页面只打包它用到的组件。
- **指令**：注册 `v-loading` 与 `v-infinite-scroll`。
- **函数**：自动导入 `toast`、`dialog`、`useDialog`、`useColorMode`、`useCountdown`、`useSortable`，以及 `vLoading`、`vInfiniteScroll`。
- **样式**：默认引入全量样式表，也可以改成按组件引入。
- **配色模式**：在 `<head>` 里放一段很小的脚本，页面在第一次绘制前就切到用户选过的明暗模式，不会先亮后暗地闪一下。

## 选项

模块的选项写在 `nuxt.config.ts` 的 `douUI` 里：

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@dou-ui/nuxt'],
  douUI: {
    css: 'on-demand',
    icons: true,
  },
})
```

| 选项         | 默认值   | 说明                                                                                        |
| ------------ | -------- | ------------------------------------------------------------------------------------------- |
| `css`        | `'full'` | 样式的引入方式：`'full'` 全量引入，`'on-demand'` 按组件引入，`false` 不引入，由应用自己处理 |
| `components` | `true`   | 自动注册组件                                                                                |
| `directives` | `true`   | 注册 `v-loading` 与 `v-infinite-scroll`                                                     |
| `imports`    | `true`   | 自动导入函数                                                                                |
| `icons`      | `false`  | 自动注册 `@dou-ui/icons` 的图标组件，如 `<SearchIcon />`（需要先安装它）                    |
| `colorMode`  | `true`   | 在 `<head>` 里注入配色模式脚本。传入对象可以设置 `storageKey` 与 `initial`，`false` 关闭    |
| `exclude`    | `[]`     | 不注册、不导入的名字，例如应用自己也定义了同名组件                                          |

### 样式

`'full'` 把整份样式表放进每个页面，简单可靠，适合大多数应用。`'on-demand'` 让每个组件连同自己的 [样式入口](/guide/getting-started#按需引入) 一起导入，页面只带上用到的样式，适合只用到少数几个组件的站点。

两种方式下，样式都由 Nuxt 在服务端渲染时写进页面，首屏不会出现无样式的闪烁。

### 图标

图标默认不注册。打开 `icons` 前先安装图标库：

```sh
bun add @dou-ui/icons
```

```vue
<template>
  <DouButton>
    <template #leading><SearchIcon /></template>
    搜索
  </DouButton>
</template>
```

应用自己有同名组件时（例如 `components/SearchIcon.vue`），以应用的为准。

## 全局配置

应用级的默认尺寸、语言与浮层层级写在 `app.config.ts` 的 `douUI` 里，效果和 [ConfigProvider](/components/config-provider) 相同：

```ts
// app/app.config.ts
import { en } from 'dou-ui'

export default defineAppConfig({
  douUI: {
    size: 'sm',
    locale: en,
  },
})
```

页面的某一部分需要不同的配置时，照常用 `<DouConfigProvider>` 包起来。

## 配色模式

模块注入的脚本和 `useColorMode()` 读写同一个本地存储键，`<DouColorModeSwitch>` 等组件也直接可用。要换存储键或初始模式，传给 `colorMode`：

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@dou-ui/nuxt'],
  douUI: {
    colorMode: { storageKey: 'my-app-theme', initial: 'dark' },
  },
})
```

服务端拿不到用户选的模式，所以服务端渲染时 `useColorMode()` 总是返回初始值。DouUI 自带的配色模式组件会在挂载后再显示真实状态；应用自己根据明暗模式渲染不同内容时，把这部分放进 `<ClientOnly>`，或者在 `onMounted` 之后再读取，避免水合不一致：

```vue
<script setup lang="ts">
const { isDark } = useColorMode()
</script>

<template>
  <ClientOnly>
    <DouTag>{{ isDark ? '深色' : '浅色' }}</DouTag>
  </ClientOnly>
</template>
```
