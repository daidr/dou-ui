# 柱状图

`DouChartBar` 用柱子的长短比较各个类目的值，`DouChartWaterfall` 用于说明一个总数是怎样一步步变化来的。

## 基础用法

柱子从 0 画到每个值，多个柱状系列在同一个位置并排显示。

<DocDemo src="chart/bar" />

- 柱子的宽度按每个位置的空间计算，最宽 56px。
- `radius` 设置柱子末端的圆角，默认 2px。柱子很多、彼此之间几乎没有空隙时不画圆角，见[大量数据](./performance#几百根堆叠柱)。

## 堆叠

`stack` 相同的柱子叠在一起，`stack` 为 `true` 的属于同一组。不同的 `stack` 名称形成并排的几组堆叠。

<DocDemo src="chart/bar-stacked" />

只有最外面一段有圆角，各段之间留出 1px 的间隔。

## 百分比堆叠

数值轴设置 `percent` 后，每组堆叠都按各部分的占比绘制，每个位置都叠满 100%，适合比较构成的变化。面积图的堆叠也可以这样设置。

<DocDemo src="chart/bar-percent" />

刻度文字默认显示百分比，提示框同时显示原始的值和占比。

## 负值与单独上色

负数向下画，图表在 0 的位置画一条基准线。

`color` 可以是一个函数，按行给每根柱子单独上色，返回 CSS 颜色或语气色名称（`danger`、`neutral` 等）；返回 `undefined` 时使用系列的颜色。下面亏损的月份使用 `danger`。

<DocDemo src="chart/bar-negative" />

散点图的 `color` 也可以写成函数。

## 横向

`horizontal` 把 x 轴放到左侧、数值放到底部，适合类目名称较长，或者需要从上往下比较的情况。

<DocDemo src="chart/bar-horizontal" />

- 坐标轴和系列的含义不变：`for="x"` 仍然是类目轴，`for="y"` 是底部的数值轴，`axis="y2"` 对应顶部的第二条数值轴。
- 左侧的类目名称最多占图表宽度的 40%，更长的名称末尾显示省略号，悬停时显示全文。

## 时间轴上的柱子

横轴是数值或时间时也可以画柱状图，比如每天一根柱子。

- 柱子的宽度按相邻两个值的最小间隔计算，横轴两端各留出半根柱子的空间。
- 柱子太密、每根不到 1.5px 时，同一像素列的柱子合并成一根从最低值画到最高值的柱子，看起来一样，绘制量只和图表宽度有关。

## 瀑布图

`DouChartWaterfall` 的 `y` 是每一步的变化量，每根柱子从之前的累计值画到加上这一步之后的累计值。`total` 标出合计行，合计行从 0 画到当前的累计值，不读这一行的 `y`。

<DocDemo src="chart/waterfall" />

- 增加的柱子用成功色，减少的用危险色，合计用系列的颜色，`color` 可以修改。
- 相邻的柱子之间用虚线连接，`:connectors="false"` 去掉虚线。
- 数据标签和提示框里的变化量带正负号，提示框还显示变化后的累计值。
- 加上 `horizontal` 画成横向的瀑布图。

瀑布图按数据的顺序累计，不要和[类目排序](./axes#类目排序)一起使用。

## API

### Bar Props

| 名称             | 说明                                                      | 类型                                                                | 默认值                              |
| ---------------- | --------------------------------------------------------- | ------------------------------------------------------------------- | ----------------------------------- |
| `y`              | 纵轴的值：字段名，或从行取值的函数                        | `string \| (row, index: number) => unknown`                         | —                                   |
| `name`           | 系列名称                                                  | `string`                                                            | `y` 的字段名                        |
| `data`           | 这个系列自己的数据                                        | `object[] \| Record<string, ArrayLike>`                             | 图表的 `data`                       |
| `x`              | 这个系列自己的横轴取值                                    | `string \| (row, index: number) => unknown`                         | 图表的 `x`                          |
| `color`          | 颜色：CSS 颜色，或按行给每根柱子上色的函数                | `string \| (row, index: number) => string \| undefined`             | 色板的下一个色                      |
| `tone`           | 用语气色作为颜色                                          | `Tone`                                                              | —                                   |
| `axis`           | 对应的数值轴                                              | `'y' \| 'y2'`                                                       | `'y'`                               |
| `stack`          | 堆叠分组，名称相同的叠在一起                              | `string \| boolean`                                                 | —                                   |
| `radius`         | 柱子末端的圆角，单位 px；柱子之间几乎没有空隙时不画       | `number`                                                            | `2`                                 |
| `labels`         | 数据标签，见[数据标签](./labels)                          | `boolean \| (label: ChartDataLabel) => string \| null \| undefined` | `false`                             |
| `labelPosition`  | 标签写在柱子末端外面，或柱子里面                          | `'outside' \| 'inside'`                                             | 堆叠时 `'inside'`，否则 `'outside'` |
| `pattern`        | 柱子上的图案，`none` 表示不加，见[外观](./theme#图案填充) | `ChartPattern \| 'none'`                                            | 图表的 `patterns`                   |
| `v-model:hidden` | 隐藏系列                                                  | `boolean`                                                           | `false`                             |

### Waterfall Props

`name`、`data`、`x`、`tone`、`axis`、`v-model:hidden` 和柱状图相同。

| 名称            | 说明                                            | 类型                                                                | 默认值                     |
| --------------- | ----------------------------------------------- | ------------------------------------------------------------------- | -------------------------- |
| `y`             | 每一步的变化量：字段名，或从行取值的函数        | `string \| (row, index: number) => unknown`                         | —                          |
| `total`         | 是否是合计行：字段名，或从行取值的函数          | `string \| (row, index: number) => unknown`                         | —                          |
| `color`         | 颜色：CSS 颜色，或按行给每根柱子上色的函数      | `string \| (row, index: number) => string \| undefined`             | 增加用成功色，减少用危险色 |
| `radius`        | 柱子的圆角，单位 px；柱子之间几乎没有空隙时不画 | `number`                                                            | `2`                        |
| `connectors`    | 用虚线连接相邻的柱子                            | `boolean`                                                           | `true`                     |
| `labels`        | 数据标签，变化量带正负号                        | `boolean \| (label: ChartDataLabel) => string \| null \| undefined` | `false`                    |
| `labelPosition` | 标签写在柱子末端外面，或柱子里面                | `'outside' \| 'inside'`                                             | `'outside'`                |
