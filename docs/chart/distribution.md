# 直方图与箱线图

`DouChartHistogram` 和 `DouChartBoxplot` 用于查看一组数据的分布。

## 直方图

直方图把 `value` 的值按区间分组，画出每个区间里有多少行。

<DocDemo src="chart/histogram" />

- 区间的宽度是一个整齐的数。默认按数据的行数决定区间个数，`bins` 指定大概的个数，`step` 直接指定区间的宽度。
- 每个区间包含起点、不包含终点，最后一个区间同时包含终点。
- 区间最多 1000 个，按 `step` 分出更多时会自动加宽。
- 提示框的标题和数据表的第一列是区间的范围。

直方图的横轴是数值轴，图表不需要写 `x`。

## 箱线图

箱线图用五个数概括每个类目的一组值，适合比较几组数据的分布。`y` 给出每一行的一组值（数组）。

<DocDemo src="chart/boxplot" />

- 箱子从下四分位画到上四分位，中间的粗线是中位数。
- 须线伸到离箱子不超过 1.5 倍箱长的最远的值，更远的值是异常值，单独画成圆点。
- `whisker` 修改这个倍数；设为 `Infinity` 时，须线伸到最小值和最大值，不再区分异常值。

提示框和数据表列出上限、上四分位、中位数、下四分位、下限和异常值。

## API

### Histogram Props

| 名称             | 说明                                                      | 类型                                                                | 默认值            |
| ---------------- | --------------------------------------------------------- | ------------------------------------------------------------------- | ----------------- |
| `value`          | 每一行的值：字段名，或从行取值的函数                      | `string \| (row, index: number) => unknown`                         | —                 |
| `bins`           | 大概的区间个数                                            | `number`                                                            | 按行数决定        |
| `step`           | 区间的宽度，设置后不读 `bins`                             | `number`                                                            | —                 |
| `name`           | 系列名称                                                  | `string`                                                            | “数量”            |
| `data`           | 这个系列自己的数据                                        | `object[] \| Record<string, ArrayLike>`                             | 图表的 `data`     |
| `color`          | 柱子的颜色                                                | `string`                                                            | 色板的下一个色    |
| `tone`           | 用语气色作为颜色                                          | `Tone`                                                              | —                 |
| `axis`           | 对应的数值轴                                              | `'y' \| 'y2'`                                                       | `'y'`             |
| `radius`         | 柱子顶端的圆角，单位 px                                   | `number`                                                            | `2`               |
| `labels`         | 数据标签，见[数据标签](./labels)                          | `boolean \| (label: ChartDataLabel) => string \| null \| undefined` | `false`           |
| `labelPosition`  | 标签写在柱子顶端外面，或柱子里面                          | `'outside' \| 'inside'`                                             | `'outside'`       |
| `pattern`        | 柱子上的图案，`none` 表示不加，见[外观](./theme#图案填充) | `ChartPattern \| 'none'`                                            | 图表的 `patterns` |
| `v-model:hidden` | 隐藏系列                                                  | `boolean`                                                           | `false`           |

### Boxplot Props

| 名称             | 说明                                         | 类型                                        | 默认值         |
| ---------------- | -------------------------------------------- | ------------------------------------------- | -------------- |
| `y`              | 每一行的一组值：字段名，或从行取值的函数     | `string \| (row, index: number) => unknown` | —              |
| `name`           | 系列名称                                     | `string`                                    | `y` 的字段名   |
| `data`           | 这个系列自己的数据                           | `object[] \| Record<string, ArrayLike>`     | 图表的 `data`  |
| `x`              | 这个系列自己的横轴取值                       | `string \| (row, index: number) => unknown` | 图表的 `x`     |
| `color`          | 箱子的颜色                                   | `string`                                    | 色板的下一个色 |
| `tone`           | 用语气色作为颜色                             | `Tone`                                      | —              |
| `axis`           | 对应的数值轴                                 | `'y' \| 'y2'`                               | `'y'`          |
| `whisker`        | 须线最远伸到箱子外几倍箱长，更远的值是异常值 | `number`                                    | `1.5`          |
| `v-model:hidden` | 隐藏系列                                     | `boolean`                                   | `false`        |
