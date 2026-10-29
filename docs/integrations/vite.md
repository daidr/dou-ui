# Vite

`@dou-ui/resolver` 让模板里用到的组件自动导入，连同它的样式入口，不用再手写 `import`。它配合按需组件插件 `unplugin-vue-components` 与自动导入插件 `unplugin-auto-import` 使用。

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

之后模板里直接写 `<DouButton>` 即可，打包结果只包含用到的组件和它们的样式。

## 选项

`DouUIResolver` 的选项：

| 选项          | 默认值  | 说明                                                                     |
| ------------- | ------- | ------------------------------------------------------------------------ |
| `importStyle` | `true`  | 同时导入组件的样式入口。已经全量引入 `dou-ui/style.css` 时设为 `false`   |
| `directives`  | `true`  | 解析 `v-loading` 与 `v-infinite-scroll`                                  |
| `icons`       | `false` | 同时解析 `@dou-ui/icons` 的图标组件，如 `<SearchIcon />`（需要先安装它） |
| `exclude`     | —       | 不解析的名字：正则或名字列表，例如应用自己也定义了同名组件               |

`DouUIApiResolver` 接受 `importStyle` 与 `exclude` 两个选项，能自动导入的函数有：

| 函数                          | 说明                                       |
| ----------------------------- | ------------------------------------------ |
| `toast`                       | [轻提示](/components/toast)                |
| `dialog`、`useDialog`         | [对话框](/components/dialog)               |
| `useColorMode`                | [配色模式](/components/color-mode)         |
| `useCountdown`                | [倒计时](/components/countdown)            |
| `useSortable`                 | [拖拽排序](/components/sortable)           |
| `vLoading`、`vInfiniteScroll` | 两个指令本身，用于 `withDirectives` 等场合 |
