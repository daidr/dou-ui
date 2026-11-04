---
wide: true
---

# 仪表盘

`@dou-ui/dashboard` 用来做可以自己摆放的页面：把若干格子放在网格上，拖动标题换位置，拖动边角改大小，其他格子会自动让开。

这一页介绍其中的网格布局 `DouGridLayout`。它只负责摆放，不关心格子里放什么，可以单独用来做可自定义的首页、卡片墙等。格子类型、编辑与撤销见[仪表盘](./dashboard.md)。

几个完整页面的写法见区块中的[运营大盘](../blocks/ops-board)、[服务大盘](../blocks/services)和[可自定义的首页](../blocks/home)。

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

每一项用 `x`、`y` 给出左上角所在的列和行（从 0 开始），用 `w`、`h` 给出占几列、几行；`id` 用来区分各项。网格默认按自身宽度分成 12、6 或 1 列（见[断点](#断点)），`v-model` 里写的是最宽时（12 列）的位置。格子的内容写在 `#item` 插槽里，插槽内容会填满整个格子。

打开 `editable` 后，可以拖动格子换位置，拖动右下角改大小。拖动时其他格子会让开，虚线框标出松手后的位置：

<DocDemo src="dashboard/basic" />

`v-model` 只在一次拖动或缩放结束时更新一次，拖动过程中的位置只用来显示。同时触发 `change` 事件，参数里有新的布局、被拖动的项和原因（`move`、`resize`、`keyboard` 或 `drop`），可以用来记录撤销或保存布局。

传入的布局如果有重叠、超出列数或者上方有空隙，组件会先整理好再显示，但不会因此更新 `v-model`。

列宽随网格的宽度变化，行高由 `rowHeight` 决定（默认 80px），格子之间的间距由 `gap` 决定（默认 16px，也可以写成 `[横向, 纵向]`）。位置完全由样式算出，服务端渲染时也能直接显示正确的布局。

## 拖动把手

默认按住格子的任意位置都能拖动。格子里有按钮、图表等需要点击或拖动的内容时，打开 `handle`，再把格子里的某一部分（比如标题栏）放进 `DouGridLayoutHandle`，只有按在这一部分上才开始拖动：

<DocDemo src="dashboard/handle" />

`DouGridLayoutHandle` 默认渲染成 `div`，用 `as` 换成其他元素，比如 `header`。不论是否打开 `handle`，按在输入框、下拉框、可编辑区域上都不会开始拖动；其他元素加上 `data-dou-nodrag` 属性也会被跳过（流程编辑器的节点里用的是同一个属性）。

## 摆放方式

`compact` 决定格子如何排列：

- `'vertical'`（默认）：每个格子都尽量往上靠，不留空隙。拖到下方空白处，松手后也会浮上来；
- `false`：格子放在哪里就停在哪里，只有被压住时才往下让。

<DocDemo src="dashboard/free" />

两种方式下，把格子拖到相邻格子上都会和它交换位置：被压住的格子先尝试移到拖动的格子原来所在的列，放不下时才往下让。

## 断点

列数随网格**自身**的宽度变化（不是窗口宽度），所以放在侧栏、对话框里也能得到合适的列数。默认网格宽度不小于 1024px 时 12 列，不小于 640px 时 6 列，更窄时 1 列。下面的示例区域较窄，断点调成了 640px 和 400px：

<DocDemo src="dashboard/responsive" />

- `v-model` 保存最宽时的布局。较窄的断点默认由它推算：按列数比例缩放位置和宽度，再往上靠；只有 1 列时按从上到下、从左到右的顺序竖排，各项保持原来的高度。
- 推算时 `y` 相同的格子算作一行。同一行里原本一样宽的格子，推算后仍然一样宽；宽度本来就不同的格子（比如 5 列和 7 列）照旧按比例并排。列数分不均时，依次这样处理：
  1. 折成两行，比如 12 列里四个 3 列宽的格子在 6 列时排成两行、每行两个，下面的格子跟着往下移。只有变窄时、并且这一行的格子一样高、没有别的格子伸进这一行时才会折行。
  2. 折不了时留在一行，宽度往小取整，留出空列，比如两个 6 列宽的格子在 5 列时各占 2 列。
  3. 往小取整后不到一列时，折成更多行，比如六个 2 列宽的格子在 4 列时排成三行。
- 对推算的结果不满意，可以在这个断点上直接拖动调整，结果单独保存在 `v-model:layouts` 里。
- 在较窄的断点上拖动或缩放后，这个断点的位置单独保存在 `v-model:layouts` 里（`{ md: [{ id, x, y, w, h }, …] }`），不影响最宽时的布局。清空某个断点就回到推算的布局；后来新加的格子在已保存的断点里按推算的位置出现。
- 只有 1 列时只能上下换位置和改高度，右边的缩放把手会隐藏。
- `columns` 和 `breakpoints` 可以换成自己的断点，名字随意，`breakpoints` 写每个断点生效的最小宽度。`columns` 写成一个数字时不分断点。
- 当前断点可以从组件实例的 `breakpoint` 读到，变化时触发 `breakpointChange`。服务端渲染和首次测量之前按最宽的断点显示。

## 从外部拖入

把列表、面板里的一项拖到网格上，就能新加一个格子。在这一项的 `pointerdown` 里调用组件实例的 `startDrop(event, item, data)`：`item` 给出新格子的 `id` 和大小，`data` 原样带到 `drop` 事件里。拖到网格上时显示落点，其他格子让开；松手后新格子加进 `v-model`，并触发 `drop`；在网格外松手或按 Esc 取消：

<DocDemo src="dashboard/drop" />

和拖动格子一样，鼠标移动几像素后开始，手指按住片刻后开始。在较窄的断点上拖入时，新格子在这个断点上放在松手的位置，在最宽的布局里放在第一个放得下的位置。

拖动只能用指针完成，所以来源最好是按钮，同时支持点击添加，让键盘和读屏用户也能用：点击时用 `findPlace` 算出第一个放得下的位置，加进 `v-model` 后用 `focusItem` 把焦点移到新格子上。上面示例里的按钮也是这样做的：

```ts
const size = { w: 3, h: 2 }
items.value = [...items.value, { id, ...size, ...findPlace(items.value, size, { columns: 12 }) }]
await nextTick()
grid.value.focusItem(id)
```

## 尺寸限制与锁定

每一项可以用 `minW`、`maxW`、`minH`、`maxH` 限制大小，拖动边角时不会超出。`locked: true` 的项不能移动和缩放，也不会被挤开，其他格子会绕过它：

<DocDemo src="dashboard/limits" />

用 `resize` 选择哪些边可以拖动改大小：`'e'`（右边）、`'s'`（下边）、`'se'`（右下角），默认 `true`，三处都可以；设为 `false` 时不能改大小。

## 触屏

在手机和平板上，手指按住格子片刻（约 0.4 秒）后才开始拖动，直接滑动仍然是滚动页面。右下角的缩放把手在触屏上始终显示，并且比鼠标下更大，按住就能拖动。手机上网格通常只有 1 列，格子从上到下排开，拖动只改变先后顺序。用指针拖动或缩放松手后，结果和键盘操作一样由读屏播报；只有 1 列时播报的是第几个，例如“已放下 新用户，第 1 个，共 5 个”。

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

每一步都会通过读屏播报格子的位置和大小。格子的读屏名称默认是它的 `id`，用 `itemLabel` 换成更好懂的名字，比如标题。

## 不用组件

布局的计算是一组纯函数，从 `@dou-ui/dashboard/layout` 引入，可以在服务端、测试或自己的拖动交互里使用。它们不修改传入的数组，返回新的数组，顺序不变，没有移动的项保持原来的对象：

```ts
import { deriveLayout, findPlace, moveItem, normalizeLayout } from '@dou-ui/dashboard/layout'

const options = { columns: 12, compact: 'vertical' } as const

// 整理：限制尺寸、去掉重叠、往上靠
const items = normalizeLayout(saved, options)

// 把 a 移到第 6 列第 0 行，其他格子随之让开
const next = moveItem(items, 'a', { x: 6, y: 0 }, options)

// 新加一个 4 × 2 的格子：找到第一个放得下的位置
const place = findPlace(next, { w: 4, h: 2 }, options)

// 推算 6 列时的布局
const narrow = deriveLayout(next, 12, { columns: 6 })
```

同样的输入总是得到同样的结果，多人同时编辑同一份布局时，各自算出的布局也一致。

## API

### GridLayout Props

| 名称          | 说明                                             | 类型                               | 默认值                         |
| ------------- | ------------------------------------------------ | ---------------------------------- | ------------------------------ |
| `modelValue`  | 最宽时各项的位置和大小，支持 `v-model`           | `GridItem[]`                       | `[]`                           |
| `layouts`     | 较窄断点上单独保存的位置，支持 `v-model:layouts` | `GridLayouts`                      | `{}`                           |
| `columns`     | 列数，一个数字或每个断点一个                     | `number \| Record<string, number>` | `{ lg: 12, md: 6, sm: 1 }`     |
| `breakpoints` | 每个断点生效的最小宽度（网格自身的宽度，px）     | `Record<string, number>`           | `{ lg: 1024, md: 640, sm: 0 }` |
| `rowHeight`   | 行高（px）                                       | `number`                           | `80`                           |
| `gap`         | 间距（px）                                       | `number \| [number, number]`       | `16`                           |
| `compact`     | 自动往上靠，或者自由摆放                         | `'vertical' \| false`              | `'vertical'`                   |
| `editable`    | 能否拖动和缩放                                   | `boolean`                          | `false`                        |
| `handle`      | 只从 `DouGridLayoutHandle` 开始拖动              | `boolean`                          | `false`                        |
| `resize`      | 哪些边可以拖动改大小，`false` 时不能改           | `boolean \| GridResizeHandle[]`    | `true`（三处都可以）           |
| `itemLabel`   | 格子的读屏名称                                   | `(item: GridItem) => string`       | 格子的 `id`                    |
| `label`       | 网格的读屏名称                                   | `string`                           | 编辑时为 `'网格布局'`          |
| `messages`    | 替换语言包里的文字                               | `DashboardMessagesOverride`        | —                              |

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

| 名称                | 说明                                   | 参数                                         |
| ------------------- | -------------------------------------- | -------------------------------------------- |
| `update:modelValue` | 一次拖动、缩放或键盘移动结束时         | `GridItem[]`                                 |
| `update:layouts`    | 在较窄的断点上改动时                   | `GridLayouts`                                |
| `change`            | 同上，带上原因和断点                   | `{ items, id, reason, breakpoint }`          |
| `drop`              | 从外部拖入的格子放下后                 | `{ item, data, breakpoint }`                 |
| `breakpointChange`  | 断点变化时                             | `string`                                     |
| `dragStart`         | 开始拖动、缩放或拖入（包括用键盘拿起） | `{ id, kind: 'move' \| 'resize' \| 'drop' }` |
| `dragEnd`           | 结束拖动或缩放                         | `{ id, kind, cancelled }`                    |

### GridLayout Slots

| 名称          | 说明                       | 参数                           |
| ------------- | -------------------------- | ------------------------------ |
| `item`        | 格子的内容                 | `{ item, dragging, resizing }` |
| `placeholder` | 拖动时标出落点的框里的内容 | `{ item }`                     |

### GridLayout Exposes

| 名称           | 说明                                             | 类型                                                                |
| -------------- | ------------------------------------------------ | ------------------------------------------------------------------- |
| `focusItem`    | 聚焦格子；不可编辑时聚焦格子里第一个可聚焦的元素 | `(id: string) => void`                                              |
| `scrollToItem` | 把格子滚动到可见区域                             | `(id: string, options?: ScrollIntoViewOptions) => void`             |
| `startDrop`    | 从外部拖入一个新格子，在 `pointerdown` 里调用    | `(event: PointerEvent, item: GridDropItem, data?: unknown) => void` |
| `breakpoint`   | 当前断点（只读）                                 | `string`                                                            |

### GridLayoutHandle Props

| 名称 | 说明       | 类型     | 默认值  |
| ---- | ---------- | -------- | ------- |
| `as` | 渲染的元素 | `string` | `'div'` |

### 布局函数

| 名称              | 说明                                                 |
| ----------------- | ---------------------------------------------------- |
| `normalizeLayout` | 整理布局；已经整理好时返回原数组                     |
| `compactLayout`   | 让所有格子往上靠                                     |
| `moveItem`        | 移动到某一格，压住的格子让开                         |
| `resizeItem`      | 改变大小，左上角不动；会压住锁定项时不改             |
| `moveItemBy`      | 按格移动，和方向键的效果相同                         |
| `resizeItemBy`    | 按格改变大小                                         |
| `findPlace`       | 找出能放下某个大小的第一个位置                       |
| `deriveLayout`    | 推算另一种列数下的布局，同一行一样宽的格子保持一样宽 |
| `fitItem`         | 把一项的大小和位置限制在网格内                       |
| `layoutHeight`    | 布局占用的行数                                       |
| `overlaps`        | 两项是否重叠                                         |

### CSS 变量

| 名称                     | 说明                     | 默认值                        |
| ------------------------ | ------------------------ | ----------------------------- |
| `--dou-grid-item-radius` | 格子、落点框和阴影的圆角 | `var(--dou-radius-container)` |
