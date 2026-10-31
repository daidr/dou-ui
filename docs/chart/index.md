# 图表

`@dou-ui/chart` 用来画折线图、面积图等统计图表。图表由一个外壳 `DouChart` 和写在里面的系列、坐标轴组成，每个部分都是一个组件，按需组合。

系列画在 canvas 上，数据量大时也能流畅绘制；坐标轴的刻度文字是普通的页面文字，跟随主题的字体和颜色。

## 安装

图表是单独的包，需要和 `dou-ui` 一起使用：

```sh
bun add dou-ui @dou-ui/chart
```

引入样式，再注册组件：

```ts
import 'dou-ui/style.css'
import '@dou-ui/chart/style.css'
import { DouChart, DouChartArea, DouChartAxis, DouChartLine } from '@dou-ui/chart'

app.use(DouChart).use(DouChartAxis).use(DouChartLine).use(DouChartArea)
```

## 基础用法

`data` 是一组行数据，`x` 指定横轴取哪个字段。系列组件用 `y` 指定纵轴的字段，`name` 是系列的名称。不写坐标轴时，图表自动显示底部的横轴和左侧的纵轴。

<DocDemo src="chart/basic" />

只有一个系列时用中性色。图表的宽度跟随容器，`height` 设置高度，默认 320px。

## 多个系列

多个系列按书写顺序依次使用图表色板里的颜色，图表下方自动显示图例；`:legend="false"` 可以关闭，只有一个系列时也可以用 `legend` 打开。`color` 可以指定任意 CSS 颜色，有明确含义时（比如错误数）用 `tone` 取语气色。

<DocDemo src="chart/multiple" />

`smooth` 把折线画成平滑的曲线。曲线经过每个数据点，并且不会在两点之间冲出比它们更高或更低的位置，峰值仍然落在真实的数据上。点太密时曲线和折线看不出区别，会直接画成折线。

折线的数据点之间有足够空间时会显示圆点，面积图默认不显示。`dots` 可以设为 `true` 或 `false` 固定显示或隐藏。`dots` 针对全部数据点；[迷你图](/components/sparkline)的 `markers` 是只标出首、尾、最高、最低几个点，两者含义不同。

## 横轴

横轴的类型由 `x` 字段的值决定：

| 值                                                               | 横轴                     |
| ---------------------------------------------------------------- | ------------------------ |
| 数字                                                             | 数值轴                   |
| `Date`，或 `'2026-10-31'`、`'2026-10-31 09:30'` 这样的日期字符串 | 时间轴                   |
| 其他字符串                                                       | 类目轴，按出现的顺序排列 |

不带时区的日期字符串按本地时间读取。时间轴会根据跨度选择刻度：分钟、小时、天、周、月或年，刻度文字只写变化的部分，跨天、跨月、跨年的位置写出完整的日期。

数值轴上 10000 以内的整数（比如年份 2019）不加千分位，并且整数数据之间不会出现小数刻度。也可以用 `<DouChartAxis position="bottom" type="category" />` 指定类型，比如把数字年份当作类目。

毫秒时间戳是数字，默认会当作数值轴，需要写 `type="time"` 才按日期显示；开发环境下检测到看起来像时间戳的横轴时会在控制台提示。

## 面积图与堆叠

`DouChartArea` 在折线下方填充浅色。面积图从 0 开始，所以纵轴一定包含 0。

<DocDemo src="chart/area" />

`stack` 相同的面积图依次叠在前一个上面，`stack` 为 `true` 时属于同一组。正数向上叠，负数向下叠。堆叠的系列需要使用同一份数据。

## 坐标轴

`DouChartAxis` 用 `position` 指定位置：`bottom` 是横轴，`left` 和 `right` 是纵轴。

<DocDemo src="chart/dual-axis" />

系列默认对应左侧纵轴，`axis="right"` 对应右侧纵轴。只写了右侧纵轴时，系列默认对应右侧纵轴。两条纵轴同时出现时，右侧的刻度会和左侧对齐，只画一套网格线。

- `min`、`max` 固定坐标轴的范围；不设置时取数据的范围，纵轴还会向外取到整齐的刻度值。
- `format` 格式化刻度文字，收到的值在数值轴上是数字，时间轴上是 `Date`，类目轴上是类目的文字。不设置时，数值按当前语言格式化，较大的数会写成“12万”这样的短格式。
- `ticks` 是大致的刻度数量，也可以是具体的刻度值数组。刻度文字放不下时会自动减少刻度。
- `type="log"` 用对数刻度，适合跨越几个数量级的数据。
- `grid` 控制网格线，默认只有左侧纵轴有；`title` 是坐标轴的标题；`hidden` 保留坐标轴的范围但不显示。

## 缺失的数据

值为 `null`、`undefined` 或不是数字时，折线在这里断开。只有一个孤立的点时会画出它的圆点，避免这个点看不见。`connect-nulls` 会跳过缺失的值把线连起来。

<DocDemo src="chart/gaps" />

## 大量数据

下面的图表有 10 万个点，可以切换到 100 万个点。

<DocDemo src="chart/large" />

一个像素宽的位置最多只能显示出最先、最低、最高和最后四个点，所以图表在每个像素列只画这四个点，画出来和逐点绘制完全一样，绘制量只和图表宽度有关。数据会读成连续的数字数组并缓存，之后的重绘不再读取原始的行数据。

使用大量数据时：

- 把数据放在 `shallowRef` 里，或用 `markRaw` 标记，避免 Vue 为每一行创建响应式代理。
- 更新时替换整个数组，不要原地修改：缓存按数组本身区分，原地修改的数组不会重新读取。
- `x`、`y` 用字段名而不是函数。模板里写的箭头函数每次渲染都是新的，无法命中缓存。

## 没有数据

所有系列都没有数值时，图表不画坐标轴，只在中间显示“没有数据”。`empty` 插槽可以替换这部分内容。

## 主题

图表的颜色都来自主题：系列颜色是 `--dou-color-chart-1` 到 `--dou-color-chart-8`，第 1 个是中性色，其余是低饱和的色相，并且明度错开，常见的色觉障碍下也能区分。切换暗色主题时图表会自动重绘。

<TokenSwatches group="chart" />

## API

### Chart Props

| 名称         | 说明                               | 类型                                        | 默认值             |
| ------------ | ---------------------------------- | ------------------------------------------- | ------------------ |
| `data`       | 行数据                             | `object[]`                                  | `[]`               |
| `x`          | 横轴的值：字段名，或从行取值的函数 | `string \| (row, index: number) => unknown` | 行的序号           |
| `height`     | 高度，数字按 px 计算               | `number \| string`                          | `320`              |
| `aria-label` | 读屏读出的名称，替换自动生成的概要 | `string`                                    | —                  |
| `legend`     | 在图表下方显示图例                 | `boolean`                                   | 多于一个系列时显示 |
| `messages`   | 替换语言包里的文字                 | `Partial<ChartMessages>`                    | —                  |

### Chart Slots

| 名称      | 说明                 |
| --------- | -------------------- |
| `default` | 系列和坐标轴         |
| `empty`   | 没有数据时显示的内容 |

### Line / Area Props

`DouChartLine` 和 `DouChartArea` 的属性相同，`stack` 只对面积图有效。

| 名称            | 说明                               | 类型                                        | 默认值                   |
| --------------- | ---------------------------------- | ------------------------------------------- | ------------------------ |
| `y`             | 纵轴的值：字段名，或从行取值的函数 | `string \| (row, index: number) => unknown` | —                        |
| `name`          | 系列名称                           | `string`                                    | `y` 的字段名             |
| `data`          | 这个系列自己的行数据               | `object[]`                                  | 图表的 `data`            |
| `x`             | 这个系列自己的横轴取值             | `string \| (row, index: number) => unknown` | 图表的 `x`               |
| `color`         | 颜色，任意 CSS 颜色                | `string`                                    | 色板的下一个色           |
| `tone`          | 用语气色作为颜色                   | `Tone`                                      | —                        |
| `axis`          | 对应的纵轴                         | `'left' \| 'right'`                         | `'left'`                 |
| `smooth`        | 画成平滑曲线                       | `boolean`                                   | `false`                  |
| `dots`          | 显示数据点                         | `boolean \| 'auto'`                         | `'auto'`，面积图 `false` |
| `dashed`        | 画成虚线                           | `boolean`                                   | `false`                  |
| `line-width`    | 线宽，单位 px                      | `number`                                    | `2`                      |
| `connect-nulls` | 跨过缺失的值连线                   | `boolean`                                   | `false`                  |
| `hidden`        | 隐藏系列，保留它的颜色和位置       | `boolean`                                   | `false`                  |
| `stack`         | 堆叠分组，名称相同的叠在一起       | `string \| boolean`                         | —                        |

### Axis Props

| 名称       | 说明                     | 类型                                          | 默认值                    |
| ---------- | ------------------------ | --------------------------------------------- | ------------------------- |
| `position` | 位置                     | `'bottom' \| 'left' \| 'right'`               | —                         |
| `type`     | 刻度类型                 | `'linear' \| 'log' \| 'time' \| 'category'`   | 横轴按数据判断，纵轴线性  |
| `min`      | 起点                     | `number \| string \| Date`                    | 数据的最小值              |
| `max`      | 终点                     | `number \| string \| Date`                    | 数据的最大值              |
| `zero`     | 纵轴包含 0               | `boolean`                                     | 有面积图时为 `true`       |
| `nice`     | 两端取到整齐的刻度值     | `boolean`                                     | 纵轴 `true`，横轴 `false` |
| `ticks`    | 刻度数量，或具体的刻度值 | `number \| (number \| string \| Date)[]`      | 按尺寸计算                |
| `format`   | 格式化刻度文字           | `(value: number \| Date \| string) => string` | —                         |
| `grid`     | 显示网格线               | `boolean`                                     | 左侧纵轴 `true`           |
| `title`    | 标题                     | `string`                                      | —                         |
| `hidden`   | 隐藏坐标轴，保留它的范围 | `boolean`                                     | `false`                   |

### CSS 变量

| 变量                   | 说明                               |
| ---------------------- | ---------------------------------- |
| `--dou-chart-grid`     | 网格线颜色                         |
| `--dou-chart-baseline` | 横轴和 0 刻度线的颜色              |
| `--dou-chart-label`    | 刻度文字颜色                       |
| `--dou-chart-title`    | 坐标轴标题颜色                     |
| `--dou-chart-surface`  | 图表所在的背景色，用于数据点的描边 |

### 读屏

根元素是 `role="img"`，名称是自动生成的概要：横轴的范围，以及每个系列的名称、数据点个数、最小值和最大值。数值按对应坐标轴的 `format` 读出，和刻度文字一致。可以用 `aria-label` 替换。
