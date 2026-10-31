---
wide: true
---

# 仪表盘

`@dou-ui/dashboard` 用来做可以自己摆放的页面：把若干格子放在网格上，拖动标题换位置，拖动边角改大小，其他格子会自动让开。

这一页介绍其中的网格布局 `DouGridLayout`。它只负责摆放，不关心格子里放什么，可以单独用来做可自定义的首页、卡片墙等。

## 安装

仪表盘是单独的包，需要和 `dou-ui` 一起使用：

```sh
bun add dou-ui @dou-ui/dashboard
```

引入样式，再注册组件：

```ts
import 'dou-ui/style.css'
import '@dou-ui/dashboard/style.css'
import { DouGridLayout } from '@dou-ui/dashboard'

app.use(DouGridLayout)
```

## 基础用法

网格默认分成 12 列。每一项用 `x`、`y` 给出左上角所在的列和行（从 0 开始），用 `w`、`h` 给出占几列、几行；`id` 用来区分各项。格子的内容写在 `#item` 插槽里，插槽内容会填满整个格子。

打开 `editable` 后，可以拖动格子换位置，拖动右下角改大小。拖动时其他格子会让开，虚线框标出松手后的位置：

<DocDemo src="dashboard/basic" />

`v-model` 只在一次拖动或缩放结束时更新一次，拖动过程中的位置只用来显示。同时触发 `change` 事件，参数里有新的布局、被拖动的项和原因（`move`、`resize` 或 `keyboard`），可以用来记录撤销或保存布局。

传入的布局如果有重叠、超出列数或者上方有空隙，组件会先整理好再显示，但不会因此更新 `v-model`。

列宽随网格的宽度变化，行高由 `row-height` 决定（默认 80px），格子之间的间距由 `gap` 决定（默认 16px，也可以写成 `[横向, 纵向]`）。位置完全由样式算出，服务端渲染时也能直接显示正确的布局。

## 拖动把手

默认按住格子的任意位置都能拖动。格子里有按钮、图表等需要点击或拖动的内容时，用 `handle` 指定一个选择器，只有按在匹配的元素上才开始拖动，比如格子的标题栏：

<DocDemo src="dashboard/handle" />

不论是否设置 `handle`，按在输入框、下拉框、可编辑区域上都不会开始拖动；其他元素加上 `data-grid-no-drag` 属性也会被跳过。

## 摆放方式

`compact` 决定格子如何排列：

- `'vertical'`（默认）：每个格子都尽量往上靠，不留空隙。拖到下方空白处，松手后也会浮上来；
- `false`：格子放在哪里就停在哪里，只有被压住时才往下让。

<DocDemo src="dashboard/free" />

两种方式下，把格子拖到相邻格子上都会和它交换位置：被压住的格子先尝试移到拖动的格子原来所在的列，放不下时才往下让。

## 尺寸限制与锁定

每一项可以用 `minW`、`maxW`、`minH`、`maxH` 限制大小，拖动边角时不会超出。`locked: true` 的项不能移动和缩放，也不会被挤开，其他格子会绕过它：

<DocDemo src="dashboard/limits" />

用 `resize` 选择哪些边可以拖动改大小：`'e'`（右边）、`'s'`（下边）、`'se'`（右下角），默认三个都有；设为 `false` 时不能改大小。

## 触屏

在手机和平板上，手指按住格子片刻（约 0.4 秒）后才开始拖动，直接滑动仍然是滚动页面。右下角的缩放把手在触屏上始终显示，并且比鼠标下更大，按住就能拖动。

拖到可滚动区域的上下边缘时，区域会自动滚动，越靠近边缘滚得越快。

## 键盘

`editable` 打开后，格子可以用 Tab 聚焦（整个网格只占一个 Tab 位置，方向键在格子之间移动焦点）：

| 按键                     | 作用                                       |
| ------------------------ | ------------------------------------------ |
| 方向键                   | 移动焦点到这个方向上最近的格子             |
| Enter / 空格             | 拿起格子                                   |
| 拿起后按方向键           | 移动一格；上下移动时会跳过只会弹回原处的行 |
| 拿起后按 Shift + 方向键  | 改变宽度或高度                             |
| 拿起后按 Enter / 空格    | 放下                                       |
| 拿起后按 Esc，或移走焦点 | 取消，回到原处                             |
| 用鼠标或手指拖动时按 Esc | 取消这次拖动                               |

每一步都会通过读屏播报格子的位置和大小。格子的读屏名称默认是它的 `id`，用 `item-label` 换成更好懂的名字，比如标题。

## 不用组件

布局的计算是一组纯函数，从 `@dou-ui/dashboard/layout` 引入，可以在服务端、测试或自己的拖动交互里使用。它们不修改传入的数组，返回新的数组，顺序不变，没有移动的项保持原来的对象：

```ts
import { findPlace, moveItem, normalizeLayout } from '@dou-ui/dashboard/layout'

const options = { columns: 12, compact: 'vertical' } as const

// 整理：限制尺寸、去掉重叠、往上靠
const items = normalizeLayout(saved, options)

// 把 a 移到第 6 列第 0 行，其他格子随之让开
const next = moveItem(items, 'a', { x: 6, y: 0 }, options)

// 新加一个 4 × 2 的格子：找到第一个放得下的位置
const place = findPlace(next, { w: 4, h: 2 }, options)
```

同样的输入总是得到同样的结果，多人同时编辑同一份布局时，各自算出的布局也一致。

## API

### GridLayout Props

| 名称          | 说明                                   | 类型                            | 默认值                |
| ------------- | -------------------------------------- | ------------------------------- | --------------------- |
| `model-value` | 各项的位置和大小，支持 `v-model`       | `GridItem[]`                    | `[]`                  |
| `columns`     | 列数                                   | `number`                        | `12`                  |
| `row-height`  | 行高（px）                             | `number`                        | `80`                  |
| `gap`         | 间距（px）                             | `number \| [number, number]`    | `16`                  |
| `compact`     | 自动往上靠，或者自由摆放               | `'vertical' \| false`           | `'vertical'`          |
| `editable`    | 能否拖动和缩放                         | `boolean`                       | `false`               |
| `handle`      | 开始拖动的部分的选择器，默认整个格子   | `string`                        | —                     |
| `resize`      | 哪些边可以拖动改大小，`false` 时不能改 | `boolean \| GridResizeHandle[]` | `['e', 's', 'se']`    |
| `item-label`  | 格子的读屏名称                         | `(item: GridItem) => string`    | 格子的 `id`           |
| `label`       | 网格的读屏名称                         | `string`                        | 编辑时为 `'网格布局'` |
| `messages`    | 替换语言包里的文字                     | `DashboardMessagesOverride`     | —                     |

### GridItem

| 名称            | 说明                           | 类型      |
| --------------- | ------------------------------ | --------- |
| `id`            | 唯一标识                       | `string`  |
| `x` / `y`       | 左上角所在的列、行，从 0 开始  | `number`  |
| `w` / `h`       | 占几列、几行                   | `number`  |
| `minW` / `maxW` | 宽度的范围（列）               | `number`  |
| `minH` / `maxH` | 高度的范围（行）               | `number`  |
| `locked`        | 不能移动和缩放，其他格子绕开它 | `boolean` |

### GridLayout Events

| 名称                | 说明                             | 参数                               |
| ------------------- | -------------------------------- | ---------------------------------- |
| `update:modelValue` | 一次拖动、缩放或键盘移动结束时   | `GridItem[]`                       |
| `change`            | 同上，带上原因                   | `{ items, id, reason }`            |
| `drag-start`        | 开始拖动或缩放（包括用键盘拿起） | `{ id, kind: 'move' \| 'resize' }` |
| `drag-end`          | 结束拖动或缩放                   | `{ id, kind, cancelled }`          |

### GridLayout Slots

| 名称          | 说明                       | 参数                           |
| ------------- | -------------------------- | ------------------------------ |
| `item`        | 格子的内容                 | `{ item, dragging, resizing }` |
| `placeholder` | 拖动时标出落点的框里的内容 | `{ item }`                     |

### GridLayout Methods

| 名称           | 说明                                             | 类型                                                    |
| -------------- | ------------------------------------------------ | ------------------------------------------------------- |
| `focusItem`    | 聚焦格子；不可编辑时聚焦格子里第一个可聚焦的元素 | `(id: string) => void`                                  |
| `scrollToItem` | 把格子滚动到可见区域                             | `(id: string, options?: ScrollIntoViewOptions) => void` |

### 布局函数

| 名称              | 说明                                     |
| ----------------- | ---------------------------------------- |
| `normalizeLayout` | 整理布局；已经整理好时返回原数组         |
| `compactLayout`   | 让所有格子往上靠                         |
| `moveItem`        | 移动到某一格，压住的格子让开             |
| `resizeItem`      | 改变大小，左上角不动；会压住锁定项时不改 |
| `moveItemBy`      | 按格移动，和方向键的效果相同             |
| `resizeItemBy`    | 按格改变大小                             |
| `findPlace`       | 找出能放下某个大小的第一个位置           |
| `fitItem`         | 把一项的大小和位置限制在网格内           |
| `layoutHeight`    | 布局占用的行数                           |
| `overlaps`        | 两项是否重叠                             |

### CSS 变量

| 名称                     | 说明                     | 默认值                        |
| ------------------------ | ------------------------ | ----------------------------- |
| `--dou-grid-item-radius` | 格子、落点框和阴影的圆角 | `var(--dou-radius-container)` |
