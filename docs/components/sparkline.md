# Sparkline 迷你图

不带坐标轴的小型折线图、面积图或柱状图，用来在表格、卡片和文字旁边显示数值的走势。

需要坐标轴、图例、缩放或多个系列时，用[图表](/chart/)。

## 基础用法

`data` 是一组数值。`type` 可以是 `line`（默认）、`area` 或 `bar`。颜色默认是中性色，`tone` 用在颜色有含义的时候，例如用 `danger` 表示错误数。`smooth` 把折线画成曲线，`markers` 用圆点标出第一个点（`first`）、最后一个点（`last`）、最低点（`min`）和最高点（`max`）。

<DocDemo src="sparkline/basic" />

默认尺寸是 120 × 32px，可以用 `width`、`height` 修改，数字按 px 计算，也可以写 `'100%'` 这样的 CSS 长度。

## 刻度

默认情况下，最低值画在底部，最高值画在顶部，所以幅度很小的变化看起来也很明显。比较几条迷你图时，应当用 `min` 和 `max` 让它们共用一个刻度，否则高度不能互相比较。

<DocDemo src="sparkline/scale" />

- 柱状图的刻度总是包含 0，柱子从 0 开始画，长度与数值成正比；负数向下画。
- 面积图填充到 0；0 不在刻度范围内时填充到底部。
- 超出 `min`、`max` 的值画在边界上，提示里显示的仍是原始数值。
- 所有数值都相同时，线画在中间。

## 空缺与提示

`null`、`NaN` 和无穷大都算作空缺，折线在这里断开；前后都是空缺的单个数值画成一个圆点。数据项也可以写成 `{ value, label }`，`label` 会显示在提示里。

鼠标悬停时显示最近一个点的数值；聚焦后可以用方向键逐个查看。`format` 用来格式化数值，`tooltip` 插槽可以完全自定义提示的内容。`:interactive="false"` 关闭提示，图不再能获得焦点。

<DocDemo src="sparkline/tooltip" />

`smooth` 使用单调曲线，曲线不会高过或低于相邻的两个点，也就不会画出数据里没有的峰值。

## 长序列

数据点比宽度多时，每一列像素只保留这一段的最低点和最高点，所以绘制的点数取决于宽度，与数据长度无关，而且任何峰值和低谷都会保留。柱状图里，每根柱子显示它所代表的那几项中离 0 最远的值。最高点、最低点等标记和读屏描述都按完整数据计算。

<DocDemo src="sparkline/long" />

## API

### Sparkline Props

| 名称          | 说明                         | 类型                                                              | 默认值      |
| ------------- | ---------------------------- | ----------------------------------------------------------------- | ----------- |
| `data`        | 数值，从左到右               | `(number \| null \| { value: number \| null; label?: string })[]` | `[]`        |
| `type`        | 图的类型                     | `'line' \| 'area' \| 'bar'`                                       | `'line'`    |
| `smooth`      | 画成曲线                     | `boolean`                                                         | `false`     |
| `tone`        | 颜色                         | `Tone`                                                            | `'neutral'` |
| `width`       | 宽度，数字按 px 计算         | `number \| string`                                                | `120`       |
| `height`      | 高度，数字按 px 计算         | `number \| string`                                                | `32`        |
| `min`         | 底部对应的数值               | `number`                                                          | 最低值      |
| `max`         | 顶部对应的数值               | `number`                                                          | 最高值      |
| `markers`     | 用圆点标出的点，柱状图不显示 | `('first' \| 'last' \| 'min' \| 'max')[]`                         | `[]`        |
| `interactive` | 悬停和聚焦时显示数值         | `boolean`                                                         | `true`      |
| `format`      | 格式化提示和读屏描述里的数值 | `(value: number) => string`                                       | —           |

### Sparkline Slots

| 名称      | 说明       | 参数                                                             |
| --------- | ---------- | ---------------------------------------------------------------- |
| `tooltip` | 提示的内容 | `{ index: number; value: number; label?: string; text: string }` |

`text` 是经过 `format` 的数值。

### CSS 变量

| 变量                         | 说明                     |
| ---------------------------- | ------------------------ |
| `--dou-sparkline-stroke`     | 线宽，默认 1.5px         |
| `--dou-sparkline-area-top`   | 面积渐变顶部的颜色       |
| `--dou-sparkline-bar-radius` | 柱子末端的圆角，默认 3px |
| `--dou-sparkline-dot`        | 圆点直径，默认 5px       |
| `--dou-sparkline-inset`      | 留给线条和圆点的内边距   |

### 键盘与读屏

- 根元素是 `role="img"`，名称是一句描述：数据个数、最低值、最高值和最新值（来自语言包的 `sparkline.summary`）。可以用 `aria-label` 替换。
- 聚焦后显示最后一个点，`←` `→` 移到前一个或后一个有数值的点，`Home` `End` 跳到第一个和最后一个，`Esc` 收起提示。提示通过 `aria-describedby` 关联到图上。
