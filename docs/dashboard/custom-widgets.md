---
wide: true
---

# 自定义格子

格子的内容由你注册的格子类型绘制：一个类型有名称、默认大小、默认设置、绘制内容的组件和设置面板。

## 基础用法

下面两个格子是同一种自己写的类型“订单趋势”：组件用 `useDashboardWidget()` 读到格子的设置和大小画出迷你图，取数时用 `setStatus` 显示加载、出错和空态。左边的格子第一次取数会失败，点“重试”后成功；右边的格子没有数据，显示空态；下面的格子设置是旧格式，组件绘制时抛错，显示“这个格子显示出错”。

<DocDemo src="dashboard/status" />

```ts
import { defineDashboardWidget } from '@dou-ui/dashboard'

const widgets = [
  defineDashboardWidget({
    type: 'orders',
    label: '订单趋势',
    defaultProps: { points: [], fail: false },
    component: StatusWidget,
  }),
]
```

## 格子类型

`defineDashboardWidget` 声明一种格子，把它们放进仪表盘的 `widgets` 属性：

```ts
import { defineDashboardWidget } from '@dou-ui/dashboard'
import { ActivityIcon } from '@dou-ui/icons'

const stat = defineDashboardWidget({
  type: 'stat',
  label: '统计数字',
  icon: ActivityIcon,
  size: { w: 3, h: 2, minW: 2, minH: 2 },
  defaultProps: { value: 0, suffix: '' },
  component: StatWidget,
  settings: StatSettings,
})
```

- `type` 存进文档里每个格子的 `type`；`label` 显示在添加格子的列表里，也是没有标题的格子的标题。
- `size` 是新格子的大小（列和行），以及缩放时的限制。
- `settings` 是设置面板里的表单组件，用 `v-model` 绑定格子的 `props`；不填时设置面板里只有标题。

各字段的类型和默认值见下方的 [DashboardWidgetType](#dashboardwidgettype)。

## 在格子里读取设置

格子的组件不接收 props，而是调用 `useDashboardWidget()` 拿到所在格子的信息：

```vue
<script setup lang="ts">
import { useDashboardWidget } from '@dou-ui/dashboard'
import { DouSparkline } from 'dou-ui'

const { props, size } = useDashboardWidget<{ points: number[] }>()
</script>

<template>
  <DouSparkline :data="props.points" :width="size.width.value" :height="size.height.value" />
</template>
```

- `props` 是格子的设置，没有时是 `{}`；`size` 是内容区域的宽高（像素），格子缩放、窗口变化时更新。
- `editing` 表示仪表盘是否在编辑；`fullscreen` 表示这一份是不是全屏查看里的那一份。
- `setProps(patch)` 把几个键合并进 `props`，算作一次可以撤销的修改。连续的修改传同一个 `group`，一秒内的会合并成一步撤销。
- 设置面板里的组件也能调用 `useDashboardWidget()`。

`useDashboardWidget()` 只能在格子的组件和设置面板里调用，在别处调用会报错。数据和筛选相关的字段见[数据与筛选](./data#usedashboardwidget)，导出用的 `setWorkbook` 见[导出与打印](./export#自己的格子类型)。

## 加载、出错与空态

格子在取数据时调用 `setStatus`，外框会在内容上方显示对应的状态，不会挤动内容：

```ts
const { setStatus } = useDashboardWidget()

setStatus('loading')
try {
  rows.value = await load()
  setStatus(rows.value.length ? 'ready' : 'empty')
} catch {
  setStatus('error', { message: '服务暂时不可用', retry: reload })
}
```

- 加载状态在 120ms 之后才出现，很快完成的请求不会闪一下；旧内容在加载时仍然可见，只是变淡。
- `error` 传了 `retry` 时显示“重试”按钮。
- 用[数据源](./data)取数的格子，加载中和出错的状态跟着数据源走，只需要在没有数据时设为 `'empty'`。

格子的组件抛出错误时（比如拿到用不了的 `props`），只有这个格子显示“这个格子显示出错”和“重试”按钮，其他格子照常显示。开发环境下控制台会输出错误和格子的 `id`。格子的 `props` 或数据变化后会重新渲染。设置面板出错时同样只在设置抽屉里显示“设置显示出错”。

只有组件初始化、渲染和挂载、更新前后的钩子里抛出的错误会让格子进入这个状态；事件处理函数、`watch` 回调里的错误不会拆掉格子，照常交给应用的 `errorHandler`。进入这个状态的错误不会再传到 `errorHandler`，而是触发 DouDashboard 的 `widgetError` 事件（`{ widget, part, error }`，`part` 是 `'content'` 或 `'settings'`），可以在这里上报到错误监控。同一个格子连续以相同的错误失败时只报一次。

`props` 是普通 JSON，常由程序或 AI 生成，类型可能不对。`@dou-ui/dashboard/widgets` 导出了内置格子读 `props` 用的几个函数，类型不对时都返回“没有设置”：

| 函数       | 说明                                                       |
| ---------- | ---------------------------------------------------------- |
| `textOf`   | 文字，否则 `undefined`                                     |
| `textsOf`  | 数组里的文字项，不是数组时返回 `[]`                        |
| `numberOf` | 有限的数字，或能转成数字的文字（`'12'`），否则 `undefined` |
| `flagOf`   | 只有 `true` 算开                                           |
| `recordOf` | 普通对象（不是数组），否则 `undefined`                     |

## API

### defineDashboardWidget

| 名称                          | 说明                             | 类型                                                          |
| ----------------------------- | -------------------------------- | ------------------------------------------------------------- |
| `defineDashboardWidget(type)` | 声明一种格子，原样返回并带上类型 | `<P>(type: DashboardWidgetType<P>) => DashboardWidgetType<P>` |

### DashboardWidgetType

| 名称           | 说明                                               | 类型                  | 默认值           |
| -------------- | -------------------------------------------------- | --------------------- | ---------------- |
| `type`         | 存进格子的 `type`                                  | `string`              | —                |
| `label`        | 添加列表里显示的名称，也是没有标题的格子的标题     | `string`              | —                |
| `icon`         | 添加列表里名称前的图标                             | `Component`           | —                |
| `size`         | 新格子的大小和缩放时的限制                         | `DashboardWidgetSize` | `{ w: 4, h: 3 }` |
| `defaultProps` | 新格子的 `props`                                   | `P \| (() => P)`      | —                |
| `component`    | 绘制格子内容的组件                                 | `Component`           | —                |
| `settings`     | 设置面板里的表单组件，`v-model` 绑定格子的 `props` | `Component`           | —                |
| `fullscreen`   | 能否全屏查看                                       | `boolean`             | `true`           |

### DashboardWidgetSize

| 名称            | 说明                 | 类型     |
| --------------- | -------------------- | -------- |
| `w` / `h`       | 新格子的列数、行数   | `number` |
| `minW` / `maxW` | 缩放时最少、最多几列 | `number` |
| `minH` / `maxH` | 缩放时最少、最多几行 | `number` |

### useDashboardWidget

`useDashboardWidget<P, D>()` 返回 `DashboardWidgetContext<P, D>`，`P` 是 `props` 的类型，`D` 是数据的类型。

| 名称         | 说明                                                 | 类型                                                                                        |
| ------------ | ---------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `widget`     | 文档里的这个格子                                     | `ComputedRef<DashboardWidget<P>>`                                                           |
| `props`      | 格子的设置                                           | `ComputedRef<P>`                                                                            |
| `editing`    | 仪表盘是否在编辑                                     | `ComputedRef<boolean>`                                                                      |
| `fullscreen` | 是否是全屏查看里的那一份                             | `ComputedRef<boolean>`                                                                      |
| `size`       | 内容区域的大小（px）                                 | `{ width: Ref<number>; height: Ref<number> }`                                               |
| `setProps`   | 合并进 `props`；`group` 相同的连续修改合并成一步撤销 | `(patch: Partial<P>, options?: { group?: string }) => void`                                 |
| `status`     | 当前状态                                             | `Readonly<Ref<DashboardWidgetStatus>>`                                                      |
| `setStatus`  | 设置状态                                             | `(state: DashboardWidgetState, options?: { message?: string; retry?: () => void }) => void` |

### DashboardWidgetStatus

| 名称      | 说明                       | 类型                                         |
| --------- | -------------------------- | -------------------------------------------- |
| `state`   | 状态                       | `'ready' \| 'loading' \| 'error' \| 'empty'` |
| `message` | 出错或空态时显示的文字     | `string`                                     |
| `retry`   | 出错时“重试”按钮调用的函数 | `() => void`                                 |

### DashboardWidgetErrorEvent

DouDashboard 的 `widgetError` 事件的参数。

| 名称     | 说明                               | 类型                      |
| -------- | ---------------------------------- | ------------------------- |
| `widget` | 格子的 id                          | `string`                  |
| `part`   | 出错的部分：格子的内容，或设置面板 | `'content' \| 'settings'` |
| `error`  | 抛出的错误                         | `unknown`                 |
