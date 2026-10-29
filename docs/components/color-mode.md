# ColorMode 颜色模式

在亮色、暗色与跟随系统之间切换整个页面。状态由组合式函数 `useColorMode()` 管理：写到 `<html>` 的 `data-dou-theme` 上，记在 `localStorage` 里，系统偏好变化或在别的标签页改了模式时自动跟上。三个组件只是它的不同外观，放在哪里都共享同一份状态。

本页的按钮会直接切换整个文档站。

## 切换按钮

`DouColorModeButton` 是一个只有图标的按钮，在亮色与暗色之间切换，图标与读屏标签随当前模式变化。适合放在顶栏。

<DocDemo src="color-mode/toggle-button" />

## 开关与下拉

`DouColorModeSwitch` 打开即暗色；`DouColorModeSelect` 多一个"跟随系统"，适合设置页。

<DocDemo src="color-mode/switch-dropdown" />

## 自己组合

`useColorMode()` 返回的 `mode` 可读可写，配合任意组件就能做出自己的切换方式，比如分段控制器：

<DocDemo src="color-mode/compose" />

## 首屏不闪烁

脚本加载前页面不知道该用哪个模式，暗色用户会先看到一闪而过的亮色。把 `colorModeScript()` 生成的脚本内联进 `<head>`，在第一次绘制前就写好 `data-dou-theme`：

```ts
import { colorModeScript } from 'dou-ui'

// 服务端渲染框架里，例如
useHead({ script: [{ innerHTML: colorModeScript() }] })
```

服务端不知道读者的模式，所以三个组件在挂载前都按"未知"渲染（按钮不画图标、开关关着、下拉显示"跟随系统"），挂载后再显示真实状态，避免水合不一致。

## 选项

整个页面共享一份状态，第一次调用时的选项生效。通常在根组件里调用一次并传入选项，其他地方直接 `useColorMode()`：

```ts
// App.vue
useColorMode({ storageKey: 'my-app-theme', initial: 'dark' })
```

切换的那一帧会暂停所有过渡，免得各处颜色先后渐变；不想要可以传 `disableTransition: false`。

## API

### useColorMode 选项

| 名称                | 说明                                           | 类型                            | 默认值             |
| ------------------- | ---------------------------------------------- | ------------------------------- | ------------------ |
| `storageKey`        | 记在 `localStorage` 的键，`false` 只存在内存里 | `string \| false`               | `'dou-color-mode'` |
| `initial`           | 用户还没选过时的模式                           | `'light' \| 'dark' \| 'system'` | `'system'`         |
| `target`            | 写 `data-dou-theme` 的元素，元素或选择器       | `string \| HTMLElement`         | `'html'`           |
| `disableTransition` | 切换的那一帧暂停过渡                           | `boolean`                       | `true`             |

### useColorMode 返回值

| 名称       | 说明                                      | 类型                                 |
| ---------- | ----------------------------------------- | ------------------------------------ |
| `mode`     | 用户的选择，可写，写入即记住              | `Ref<'light' \| 'dark' \| 'system'>` |
| `resolved` | 实际使用的模式，`system` 已换算           | `Readonly<Ref<'light' \| 'dark'>>`   |
| `system`   | 系统偏好                                  | `Readonly<Ref<'light' \| 'dark'>>`   |
| `isDark`   | 是否暗色，可写，写入即选定 `dark`/`light` | `WritableComputedRef<boolean>`       |

`colorModeScript(options)` 接受与 `useColorMode` 相同的 `storageKey`、`initial`、`target`，返回一段脚本字符串。

### ColorModeButton Props

| 名称      | 说明     | 类型                                        | 默认值    |
| --------- | -------- | ------------------------------------------- | --------- |
| `size`    | 尺寸     | `'sm' \| 'md' \| 'lg'`                      | `'md'`    |
| `variant` | 按钮变体 | `'solid' \| 'soft' \| 'outline' \| 'ghost'` | `'ghost'` |

### ColorModeSwitch Props

| 名称       | 说明 | 类型                   | 默认值  |
| ---------- | ---- | ---------------------- | ------- |
| `size`     | 尺寸 | `'sm' \| 'md' \| 'lg'` | `'md'`  |
| `disabled` | 禁用 | `boolean`              | `false` |

默认插槽是开关旁的标签。

### ColorModeSelect Props

| 名称       | 说明 | 类型                   | 默认值  |
| ---------- | ---- | ---------------------- | ------- |
| `size`     | 尺寸 | `'sm' \| 'md' \| 'lg'` | `'md'`  |
| `disabled` | 禁用 | `boolean`              | `false` |

### 键盘与读屏

- 按钮的标签是将要切换到的模式："切换到暗色模式" / "切换到亮色模式"。
- 开关的 `aria-checked` 表示是否暗色；有可见标签时由标签命名，没有时名为"暗色"。
- 下拉名为"颜色模式"，键盘操作同 [Select](./select)。
