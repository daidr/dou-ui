# ConfigProvider 全局配置

为一棵子树里的组件提供默认值：尺寸、语言、浮层层级与位置，以及各组件的默认属性。配置可以嵌套，内层没有设置的项沿用外层。

## 默认尺寸

组件没有设置 `size` 时，依次取表单的尺寸、最近的全局配置，最后是 `md`。

<DocDemo src="config-provider/default-size" column />

## 国际化

组件自己渲染的文字（清空、移除按钮的读屏标签，表单的默认错误信息与"可选"标记）都来自语言包。DouUI 内置 `zhCN`（默认）与 `en`。

<DocDemo src="config-provider/i18n" />

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

`zIndex` 是浮层（提示、弹出层、对话框等）的起始层级，默认 `2000`。每打开一个浮层，层级在此基础上递增，后打开的总在上面（见 [浮层](../guide/overlays#层级)）。

```vue
<DouConfigProvider :z-index="3000">...</DouConfigProvider>
```

## 组件默认属性

`defaults` 按组件名设置默认属性，适合统一整个应用的写法，比如按钮默认用描边样式、表格默认带斑马纹。组件上直接写的属性总是优先。

<DocDemo src="config-provider/defaults" />

嵌套的配置按组件合并：内层只写 `{ DouButton: { tone: 'danger' } }` 时，外层设置的 `variant` 仍然生效。默认属性在组件创建时读取，之后修改配置不影响已经渲染的组件。

```ts
app.use(DouUI, {
  defaults: {
    DouButton: { variant: 'outline' },
    DouTable: { stripe: true },
    DouDialog: { destroyOnClose: true },
  },
})
```

`defaults` 的类型是 `ComponentDefaults`，每个组件的属性都有提示。

## 浮层渲染位置

浮层默认渲染到 `<body>`。`teleport` 可以给子树里所有浮层统一换一个容器，比如微前端里挂到子应用自己的根节点；传 `false` 则原地渲染。单个组件上写的 `teleport` 优先。

````vue
<DouConfigProvider teleport="#app">...</DouConfigProvider>

## 动效

`motion` 设置动画的模式：`auto` 跟随系统的“减少动态效果”设置，`reduce` 只保留短暂的淡入淡出，`none` 关闭全部动画。浮层渲染在 `<body>` 下，所以这个设置作用于整个页面，组件卸载后恢复原来的值（见 [动效](../guide/motion#减少与关闭动画)）。

```vue
<DouConfigProvider motion="reduce">...</DouConfigProvider>
````

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

| 函数                 | 说明                                                    |
| -------------------- | ------------------------------------------------------- |
| `useGlobalConfig()`  | 当前生效的配置，已填好默认值                            |
| `useLocale()`        | 返回 `{ locale, t }`，`t('form.required')` 读取一条文案 |
| `useZIndex()`        | 返回 `{ base, current, next }`，`next()` 取一个新的层级 |
| `useReducedMotion()` | 是否应减少动画，见 [动效](../guide/motion#在脚本中使用) |

## API

### Props

| 名称       | 说明                                   | 类型                             | 默认值   |
| ---------- | -------------------------------------- | -------------------------------- | -------- |
| `size`     | 组件的默认尺寸                         | `'sm' \| 'md' \| 'lg'`           | `'md'`   |
| `locale`   | 语言包                                 | `Locale`                         | `zhCN`   |
| `zIndex`   | 浮层的起始层级                         | `number`                         | `2000`   |
| `teleport` | 浮层的默认渲染位置，`false` 为原地渲染 | `string \| HTMLElement \| false` | `'body'` |
| `defaults` | 各组件的默认属性                       | `ComponentDefaults`              | —        |
| `motion`   | 动画模式                               | `'auto' \| 'reduce' \| 'none'`   | `'auto'` |

### Slots

| 名称      | 说明     |
| --------- | -------- |
| `default` | 子树内容 |

`DouConfigProvider` 不渲染任何元素，只提供配置（`motion` 除外，它写在 `<html>` 上）。
