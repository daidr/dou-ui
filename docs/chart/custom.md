# 自定义系列

`defineChartSeries` 用于定义自己的系列组件。它和内置系列一样放在 `DouChart` 里，共用坐标轴、堆叠、图例和配色。内置的折线、面积、柱状和散点系列也通过同一个接口实现。

## 基础用法

下面定义了一个棒棒糖图系列。

<DocDemo src="chart/custom" />

定义系列时需要说明两件事：坐标轴怎样包含它的数据（`zero`、`band`、`inset`），以及怎样画出来（`draw`）。

```ts
import { defineChartSeries } from '@dou-ui/chart'

export const DouChartLollipop = defineChartSeries({
  type: 'lollipop', // 组件名为 DouChartLollipop，图例里的类名为 is-lollipop
  zero: true, // 数值轴包含 0
  stackable: false, // 是否支持 stack
  band: false, // 是否像柱子一样在每个位置并排分配空间
  inset: (series) => 0, // 每个点周围需要留出的像素，比如气泡的半径
  tooltip: 'axis', // 提示框按位置（'axis'）还是按单个点（'item'）显示
  props: { radius: { type: Number, default: 5 } }, // 自己的属性
  draw(painter, series, view) {},
})
```

## 绘制

`draw` 收到三个参数：

- `painter`：canvas 2D 上下文的一部分方法，只通过它绘制。
- `series`：读取好的数据。
- `view`：把值换算成位置的方法。

`series` 常用的属性：

| 属性              | 说明                                                                   |
| ----------------- | ---------------------------------------------------------------------- |
| `series.x.values` | 横轴的值，类目轴上是类目的序号                                         |
| `series.top`      | 要画的值，堆叠时是这一段的顶端                                         |
| `series.base`     | 堆叠时这一段的底端                                                     |
| `series.rows`     | 原始的行数据                                                           |
| `series.props`    | 组件的属性                                                             |
| `series.color`    | 计算好的颜色                                                           |
| `series.colors`   | `color` 写成函数时，按行计算好的各点颜色；没有单独颜色时是 `undefined` |
| `series.prepared` | `prepare` 的返回值，见[提前准备](#提前准备)                            |

`view` 常用的属性：

| 属性                   | 说明                                                               |
| ---------------------- | ------------------------------------------------------------------ |
| `view.point(x, value)` | 这个值画在哪里，返回 `[left, top]`，竖向和横向图都一样，一般只用它 |
| `view.x`、`view.y`     | 两个比例尺，`map` 把值换算成沿轴的像素，`invert` 反过来            |
| `view.horizontal`      | 是否是横向图                                                       |
| `view.band`            | 每个位置的宽度（像素）                                             |
| `view.plot`            | 绘图区域                                                           |

## 按单个点显示提示框

`tooltip: 'item'` 时提示框按单个点显示。`hit` 找出指针下的点，返回点的序号和半径；不写时找 12px 以内最近的点。

## 提前准备

数据很多时，`hit` 逐个比较所有点会变慢，可以在 `prepare` 里提前建好索引。

- 数据不再变化 300 毫秒后，图表在浏览器空闲时调用 `prepare`，返回值放在 `series.prepared` 里。
- 数据每秒更新很多次时（实时数据）不会调用。
- `prepare` 运行之前 `series.prepared` 是 `undefined`，所以 `hit` 和 `draw` 要能在没有它的情况下照常工作。

```ts
defineChartSeries({
  type: 'dots',
  tooltip: 'item',
  // 按 x 取整分桶：每个整数位置有哪些点
  prepare(series) {
    const buckets = new Map<number, number[]>()
    series.x.values.forEach((x, i) => {
      const key = Math.round(x)
      let bucket = buckets.get(key)
      if (!bucket) buckets.set(key, (bucket = []))
      bucket.push(i)
    })
    return buckets
  },
  hit(series, view, px, py) {
    const buckets = series.prepared as Map<number, number[]> | undefined
    const x = Math.round(view.x.invert(px))
    // 还没有索引时逐个查找
    const candidates = buckets
      ? [x - 1, x, x + 1].flatMap((key) => buckets.get(key) ?? [])
      : series.x.values.map((_, i) => i)
    let best = null
    for (const i of candidates) {
      const [left, top] = view.point(series.x.values[i], series.top[i])
      const d = Math.hypot(left - px, top - py)
      if (d <= 12 && (!best || d < best.d)) best = { index: i, radius: 4, d }
    }
    return best
  },
  draw(painter, series, view) {
    /* … */
  },
})
```

## API

### defineChartSeries

| 选项        | 说明                                                                             | 类型                                                |
| ----------- | -------------------------------------------------------------------------------- | --------------------------------------------------- |
| `type`      | 系列类型，组件名为 `DouChart` 加上首字母大写的类型                               | `string`                                            |
| `zero`      | 数值轴包含 0                                                                     | `boolean`                                           |
| `stackable` | 支持 `stack` 堆叠                                                                | `boolean`                                           |
| `band`      | 在每个位置并排分配空间，x 轴两端留出半个位置                                     | `boolean`                                           |
| `inset`     | 每个点周围需要的空间（像素），坐标轴会放宽到能放下                               | `(series) => number`                                |
| `tooltip`   | 提示框默认按位置还是按单个点显示                                                 | `'axis' \| 'item'`                                  |
| `hit`       | 按单个点显示时，找出指针下的点和它的半径                                         | `(series, view, x, y) => { index, radius } \| null` |
| `prepare`   | 数据不再变化、浏览器空闲时提前做的准备，返回值放在 `series.prepared`             | `(series) => unknown`                               |
| `props`     | 组件自己的属性，写法和 Vue 组件的 `props` 相同；会和下方的通用属性合并，不要重名 | `object`                                            |
| `draw`      | 绘制                                                                             | `(painter, series, view) => void`                   |

### 通用属性

`defineChartSeries` 生成的组件都带有下面这些属性，自己的 `props` 会和它们合并。

| 名称             | 说明                                     | 类型                                        |
| ---------------- | ---------------------------------------- | ------------------------------------------- |
| `y`              | 必填，纵轴的值：字段名，或从行取值的函数 | `string \| (row, index: number) => unknown` |
| `name`           | 系列名称                                 | `string`                                    |
| `data`           | 这个系列自己的数据                       | `object[] \| Record<string, ArrayLike>`     |
| `x`              | 这个系列自己的横轴取值                   | `string \| (row, index: number) => unknown` |
| `color`          | 颜色，任意 CSS 颜色                      | `string`                                    |
| `tone`           | 用语气色作为颜色                         | `Tone`                                      |
| `axis`           | 对应的数值轴                             | `'y' \| 'y2'`                               |
| `stack`          | 堆叠分组，`stackable` 为 `true` 时有效   | `string \| boolean`                         |
| `v-model:hidden` | 隐藏系列                                 | `boolean`                                   |
