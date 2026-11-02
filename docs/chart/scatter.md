# 散点图与热力图

`DouChartScatter` 在每个数据点画一个圆点，用于观察两个数值之间的关系。`DouChartHeatmap` 把数据画成一格一格的矩阵，用颜色深浅表示值的大小。

## 散点图

<DocDemo src="chart/scatter" />

- 圆点略微透明，重叠的地方颜色更深。
- `radius` 设置圆点的半径，默认 3.5px。
- 系列可以用 `data` 带上自己的数据，图表的 `x` 对每个系列的数据都有效。
- 提示框的标题默认是系列名称，`label` 可以改为每个点自己的名称。

数据点超过 2000 个时，所有圆点先合成一张图再一次画出，10 万个点重绘约 50ms。这时重叠的地方不再加深，`color` 函数也不再生效。

## 气泡图

`size` 指定每个点的大小，画成气泡图。

<DocDemo src="chart/bubble" />

- 气泡的面积和值成正比，`radius` 是最大气泡的半径，默认 24px。
- 大气泡先画，小气泡不会被盖住。
- `sizeName` 设置提示框里气泡大小这一项的名称。

## 热力图

图表的 `x` 决定每格所在的列，热力图的 `y` 决定所在的行，`value` 是格子的值。

<DocDemo src="chart/heatmap" />

- 值越大颜色越深，颜色从背景色过渡到系列的颜色。
- 纵轴按数据中出现的顺序列出各行，第一行在最上面。
- 默认显示图例，图例画出色阶和最小、最大值。

## 色阶范围

色阶默认在数据的最小值和最大值之间。`min`、`max` 指定色阶两端对应的值，超出的值按两端的颜色画。几张热力图使用相同的 `min`、`max` 时，颜色可以互相比较。

`format` 设置值的写法，用于提示框、数据标签、图例、读屏和数据表。`labels` 在每格中间写上值，文字颜色按格子的深浅自动选择，放不下的格子不写。

<DocDemo src="chart/heatmap-labels" />

用键盘浏览热力图时，左右方向键在同一行中移动，上下方向键在同一列中换行。

## API

### Scatter Props

| 名称             | 说明                                                                 | 类型                                                    | 默认值             |
| ---------------- | -------------------------------------------------------------------- | ------------------------------------------------------- | ------------------ |
| `y`              | 纵轴的值：字段名，或从行取值的函数                                   | `string \| (row, index: number) => unknown`             | —                  |
| `name`           | 系列名称                                                             | `string`                                                | `y` 的字段名       |
| `data`           | 这个系列自己的数据                                                   | `object[] \| Record<string, ArrayLike>`                 | 图表的 `data`      |
| `x`              | 这个系列自己的横轴取值                                               | `string \| (row, index: number) => unknown`             | 图表的 `x`         |
| `color`          | 颜色：CSS 颜色，或按行给每个点上色的函数；超过 2000 个点时不按行上色 | `string \| (row, index: number) => string \| undefined` | 色板的下一个色     |
| `tone`           | 用语气色作为颜色                                                     | `Tone`                                                  | —                  |
| `axis`           | 对应的数值轴                                                         | `'y' \| 'y2'`                                           | `'y'`              |
| `size`           | 每个点的大小：字段名，或从行取值的函数                               | `string \| (row, index: number) => unknown`             | —                  |
| `sizeName`       | 提示框里大小这一项的名称                                             | `string`                                                | `size` 的字段名    |
| `label`          | 每个点的名称，用作提示框的标题                                       | `string \| (row, index: number) => unknown`             | 系列名称           |
| `radius`         | 圆点半径，单位 px；有 `size` 时是最大气泡的半径                      | `number`                                                | `3.5`，气泡为 `24` |
| `v-model:hidden` | 隐藏系列                                                             | `boolean`                                               | `false`            |

### Heatmap Props

| 名称             | 说明                                               | 类型                                                                | 默认值         |
| ---------------- | -------------------------------------------------- | ------------------------------------------------------------------- | -------------- |
| `y`              | 每格所在的行：字段名，或从行取值的函数             | `string \| (row, index: number) => unknown`                         | —              |
| `value`          | 每格的值                                           | `string \| (row, index: number) => unknown`                         | —              |
| `name`           | 系列名称                                           | `string`                                                            | `y` 的字段名   |
| `data`           | 这个系列自己的数据                                 | `object[] \| Record<string, ArrayLike>`                             | 图表的 `data`  |
| `x`              | 每格所在的列                                       | `string \| (row, index: number) => unknown`                         | 图表的 `x`     |
| `color`          | 色阶最深一端的颜色，任意 CSS 颜色                  | `string`                                                            | 色板的下一个色 |
| `tone`           | 用语气色作为色阶最深一端的颜色                     | `Tone`                                                              | —              |
| `min`            | 色阶最浅一端对应的值                               | `number`                                                            | 数据的最小值   |
| `max`            | 色阶最深一端对应的值                               | `number`                                                            | 数据的最大值   |
| `format`         | 值的写法，用于提示框、数据标签、图例、读屏和数据表 | `(value: number) => string`                                         | 按语言写数字   |
| `labels`         | 在每格中间写上值，见[数据标签](./labels)           | `boolean \| (label: ChartDataLabel) => string \| null \| undefined` | `false`        |
| `v-model:hidden` | 隐藏系列                                           | `boolean`                                                           | `false`        |
