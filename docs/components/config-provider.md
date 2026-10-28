# ConfigProvider 全局配置

为一棵子树里的组件提供默认值：尺寸、语言与浮层层级。配置可以嵌套，内层没有设置的项沿用外层。

<script setup>
import { ref } from 'vue'
import { en } from 'dou-ui'
const keyword = ref('dou-ui')
</script>

## 默认尺寸

组件没有设置 `size` 时，依次取表单的尺寸、最近的全局配置，最后是 `md`。

<div class="demo demo--column">
  <DouConfigProvider size="sm">
    <DouSpace size="sm">
      <DouInput placeholder="sm" style="width: 200px" />
      <DouButton variant="outline">搜索</DouButton>
      <DouTag>标签</DouTag>
    </DouSpace>
  </DouConfigProvider>
  <DouConfigProvider size="lg">
    <DouSpace size="sm">
      <DouInput placeholder="lg" style="width: 200px" />
      <DouButton variant="outline">搜索</DouButton>
      <DouTag>标签</DouTag>
    </DouSpace>
  </DouConfigProvider>
</div>

```vue
<DouConfigProvider size="sm">
  <DouInput />
  <DouButton>搜索</DouButton>
</DouConfigProvider>
```

## 国际化

组件自己渲染的文字（清空、移除按钮的读屏标签，表单的默认错误信息与"可选"标记）都来自语言包。DouUI 内置 `zhCN`（默认）与 `en`。

<div class="demo">
  <DouConfigProvider :locale="en">
    <DouSpace size="sm">
      <DouInput v-model="keyword" clearable style="width: 200px" />
      <DouTag closable>closable</DouTag>
    </DouSpace>
  </DouConfigProvider>
</div>

```vue
<script setup lang="ts">
import { en } from 'dou-ui'
</script>

<template>
  <DouConfigProvider :locale="en">
    <App />
  </DouConfigProvider>
</template>
```

上例中清空与移除按钮的 `aria-label` 分别是 "Clear" 与 "Remove"。

### 自定义语言包

语言包是一个普通对象，类型为 `Locale`。在内置语言包上改几条即可：

```ts
import { zhCN } from 'dou-ui'
import type { Locale } from 'dou-ui'

const locale: Locale = {
  ...zhCN,
  form: { ...zhCN.form, required: '必填' },
}
```

文案中的 `{min}`、`{max}` 等占位符会在使用时被替换。

## 浮层层级

`zIndex` 是浮层（提示、弹出层、对话框等）的起始层级，默认 `2000`。每打开一个浮层，层级在此基础上递增，后打开的总在上面。

```vue
<DouConfigProvider :z-index="3000">...</DouConfigProvider>
```

## 应用级配置

不想多包一层组件时，可以在注册插件时传入同样的配置：

```ts
import DouUI, { en } from 'dou-ui'

app.use(DouUI, { size: 'sm', locale: en, zIndex: 3000 })
```

按需引入组件时，在根组件的 `setup` 中调用 `provideGlobalConfig` 效果相同：

```ts
import { provideGlobalConfig } from 'dou-ui'

provideGlobalConfig({ size: 'sm' })
```

## 在自己的组件中读取

| 函数                | 说明                                                    |
| ------------------- | ------------------------------------------------------- |
| `useGlobalConfig()` | 当前生效的配置，已填好默认值                            |
| `useLocale()`       | 返回 `{ locale, t }`，`t('form.required')` 读取一条文案 |
| `useZIndex()`       | 返回 `{ base, current, next }`，`next()` 取一个新的层级 |

## API

### Props

| 名称     | 说明           | 类型                   | 默认值 |
| -------- | -------------- | ---------------------- | ------ |
| `size`   | 组件的默认尺寸 | `'sm' \| 'md' \| 'lg'` | `'md'` |
| `locale` | 语言包         | `Locale`               | `zhCN` |
| `zIndex` | 浮层的起始层级 | `number`               | `2000` |

### Slots

| 名称      | 说明     |
| --------- | -------- |
| `default` | 子树内容 |

`DouConfigProvider` 不渲染任何元素，只提供配置。
