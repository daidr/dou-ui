# 折线图与面积图

`DouChartLine` 用于展示数据随时间或顺序的变化，`DouChartArea` 在折线下方再填充浅色。

## 折线图

<DocDemo src="chart/line" />

- `smooth` 把折线画成平滑的曲线。曲线经过每个数据点，不会在两点之间超出它们的范围，所以峰值仍然在真实的数据上。点很密时直接画成折线。
- `dots` 控制是否显示数据点。默认在点之间有足够空间时显示，`true` 或 `false` 固定显示或隐藏。
- `dashed` 画成虚线，`lineWidth` 设置线宽。

## 阶梯线

`step` 把折线画成阶梯，适合库存、价格、状态这类只在某些时刻变化的数据。

<DocDemo src="chart/step" />

- `step` 或 `step="after"`：保持当前值，到下一个点才变化。
- `step="before"`：在当前点就变成下一个值。
- `step="middle"`：在两点中间变化。

阶梯线不受 `smooth` 影响，面积图也可以设置。

## 面积图

面积图从 0 开始填充，所以纵轴一定包含 0。面积图默认不显示数据点。

<DocDemo src="chart/area" />

`stack` 相同的面积图依次叠在前一个上面，`stack` 为 `true` 的属于同一组。正数向上叠，负数向下叠。堆叠的系列需要使用同一份数据。

数值轴设置 `percent` 后，每个位置都按占比叠满 100%，见[柱状图 · 百分比堆叠](./bar#百分比堆叠)。

## 区间

`y0` 指定面积的下边界，面积图就画成从 `y0` 到 `y` 的一条带，比如每天的最低和最高气温，或者预测值的范围。

<DocDemo src="chart/area-band" />

- 纵轴不必包含 0。
- 上下两条边线都会画出，`:line-width="0"` 只保留填充。
- 提示框显示两端的值。
- `y0` 不能和 `stack` 一起使用。

## 缺失的数据

值为 `null`、`undefined` 或不是数字时，折线在这里断开。孤立的单个点会画出圆点，避免看不见。`connectNulls` 跳过缺失的值，把线连起来。

<DocDemo src="chart/gaps" />

## API

### Line / Area Props

`DouChartLine` 和 `DouChartArea` 的属性相同，`stack`、`y0` 和 `pattern` 只对面积图有效。

| 名称             | 说明                                                                | 类型                                                                | 默认值                   |
| ---------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------ |
| `y`              | 纵轴的值：字段名，或从行取值的函数                                  | `string \| (row, index: number) => unknown`                         | —                        |
| `name`           | 系列名称                                                            | `string`                                                            | `y` 的字段名             |
| `data`           | 这个系列自己的数据，写法同图表的 `data`                             | `object[] \| Record<string, ArrayLike>`                             | 图表的 `data`            |
| `x`              | 这个系列自己的横轴取值                                              | `string \| (row, index: number) => unknown`                         | 图表的 `x`               |
| `color`          | 颜色，任意 CSS 颜色                                                 | `string`                                                            | 色板的下一个色           |
| `tone`           | 用语气色作为颜色                                                    | `Tone`                                                              | —                        |
| `axis`           | 对应的数值轴                                                        | `'y' \| 'y2'`                                                       | `'y'`                    |
| `smooth`         | 画成平滑曲线                                                        | `boolean`                                                           | `false`                  |
| `dots`           | 显示数据点                                                          | `boolean \| 'auto'`                                                 | `'auto'`，面积图 `false` |
| `dashed`         | 画成虚线                                                            | `boolean`                                                           | `false`                  |
| `lineWidth`      | 线宽，单位 px                                                       | `number`                                                            | `2`                      |
| `connectNulls`   | 跨过缺失的值连线                                                    | `boolean`                                                           | `false`                  |
| `step`           | 画成阶梯线                                                          | `boolean \| 'before' \| 'after' \| 'middle'`                        | `false`                  |
| `labels`         | 数据标签，见[数据标签](./labels)                                    | `boolean \| (label: ChartDataLabel) => string \| null \| undefined` | `false`                  |
| `labelPosition`  | 标签写在每个点上方，或只写在最后一个点旁边                          | `'point' \| 'end'`                                                  | `'point'`                |
| `v-model:hidden` | 隐藏系列，保留它的颜色和图例                                        | `boolean`                                                           | `false`                  |
| `stack`          | 仅面积图：堆叠分组，名称相同的叠在一起                              | `string \| boolean`                                                 | —                        |
| `y0`             | 仅面积图：面积的下边界，画成从 `y0` 到 `y` 的带                     | `string \| (row, index: number) => unknown`                         | —                        |
| `pattern`        | 仅面积图：填充上的图案，`none` 表示不加，见[外观](./theme#图案填充) | `ChartPattern \| 'none'`                                            | 图表的 `patterns`        |
