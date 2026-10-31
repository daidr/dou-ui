# 图表

`@dou-ui/chart` 用来画折线图、面积图、柱状图、散点图、饼图等统计图表。图表由一个外壳 `DouChart` 和写在里面的系列、坐标轴组成，每个部分都是一个组件，按需组合。

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
import { DouChart, DouChartAxis, DouChartBar, DouChartLine } from '@dou-ui/chart'

app.use(DouChart).use(DouChartAxis).use(DouChartLine).use(DouChartBar)
```

用到哪种系列就注册哪个组件：`DouChartLine`、`DouChartArea`、`DouChartBar`、`DouChartScatter`、`DouChartPie`。

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

数值轴上 10000 以内的整数（比如年份 2019）不加千分位，并且整数数据之间不会出现小数刻度。也可以用 `<DouChartAxis for="x" type="category" />` 指定类型，比如把数字年份当作类目。

毫秒时间戳是数字，默认会当作数值轴，需要写 `type="time"` 才按日期显示；开发环境下检测到看起来像时间戳的横轴时会在控制台提示。

## 面积图与堆叠

`DouChartArea` 在折线下方填充浅色。面积图从 0 开始，所以纵轴一定包含 0。

<DocDemo src="chart/area" />

`stack` 相同的面积图依次叠在前一个上面，`stack` 为 `true` 时属于同一组。正数向上叠，负数向下叠。堆叠的系列需要使用同一份数据。

## 柱状图

`DouChartBar` 从 0 画到每个值。多个柱状系列在同一个位置并排显示。

<DocDemo src="chart/bar" />

柱子的宽度按每个位置的空间计算，空间很大时也不会超过 56px。`radius` 是柱子末端的圆角，默认 2px。

### 堆叠

和面积图一样，`stack` 相同的柱子叠在一起，`stack` 为 `true` 时属于同一组。只有最外面一段有圆角，各段之间留出 1px 的间隔。不同的 `stack` 名称会形成并排的几组堆叠。

<DocDemo src="chart/bar-stacked" />

### 负值

负数向下画，图表在 0 的位置画一条基准线。

<DocDemo src="chart/bar-negative" />

### 横向

`horizontal` 把 x 轴放到左侧、数值放到底部，适合类目名称较长或者需要从上往下比较的情况。坐标轴和系列的含义不变，只是画的位置变了：`for="x"` 仍然是类目轴，`for="y"` 是底部的数值轴，`axis="y2"` 的系列对应顶部的第二条数值轴。从竖向改成横向只需要加上 `horizontal`。

左侧的类目名称最多占图表宽度的 40%，更长的名称末尾显示省略号，鼠标悬停时显示全文。

<DocDemo src="chart/bar-horizontal" />

横轴是数值或时间时也可以画柱状图，比如每天一根柱子。柱子的宽度按相邻两个值的最小间隔计算，横轴两端会各留出半根柱子的空间。柱子太密、每根不到 1.5px 时，同一像素列的柱子会合并成一根从最低值到最高值的柱子，看起来一样，绘制量只和图表宽度有关。

## 散点图

`DouChartScatter` 在每个数据点画一个圆点。圆点略微透明，重叠的地方颜色更深。系列可以用 `data` 带上自己的数据，图表的 `x` 对每个系列的数据都有效。

<DocDemo src="chart/scatter" />

`radius` 是圆点的半径，默认 3.5px。数据点超过 2000 个时，所有圆点会先合成一张图再一次画出，10 万个点重绘约 50ms；这时重叠的地方不再加深。

### 气泡图

`size` 指定每个点的大小，画成气泡：气泡的面积和值成正比，`radius` 是最大气泡的半径，默认 24px。大气泡先画，小气泡不会被盖住。

<DocDemo src="chart/bubble" />

## 饼图

`DouChartPie` 画一个饼图，`value` 是每一块的值，`label` 是每一块的名称，不写时使用图表的 `x`。各块按数据的顺序从 12 点钟方向顺时针排列，小于等于 0 的值不画。饼图没有坐标轴，下方的图例列出每一块。

<DocDemo src="chart/pie" />

每一块默认依次使用色板里的彩色，跳过第 1 个中性灰。`color` 可以给每一块指定颜色：字段名或函数，返回任意 CSS 颜色，或者 `danger` 这样的语气色名称；返回 `neutral` 时使用色板的中性灰，适合“其他”。色板只有 7 种彩色，块数更多时颜色会重复，建议把较小的几块合并成“其他”，开发环境下会在控制台提示。

`inner-radius` 是中间空洞占半径的比例，设置后画成环形图。默认插槽的内容显示在空洞中间，可以放合计或说明。

<DocDemo src="chart/donut" />

一个图表里只画一个饼图，饼图和其他系列不能放在同一个图表里。读屏会读出每一块的名称、值和占比，`name` 会读在最前面。

## 组合图

不同的系列可以放在同一个图表里，比如柱状图配合折线图，再用第二条数值轴显示另一种单位。

<DocDemo src="chart/combo" />

## 坐标轴

`DouChartAxis` 用 `for` 指定设置的是哪条轴：`x` 是 x 轴，`y` 是数值轴，`y2` 是第二条数值轴。竖向图里 x 轴在底部，`y` 在左侧，`y2` 在右侧；横向图里 x 轴在左侧，`y` 在底部，`y2` 在顶部。

<DocDemo src="chart/dual-axis" />

系列默认对应 `y`，`axis="y2"` 对应第二条数值轴。只写了 `y2` 时，系列默认对应 `y2`。两条数值轴同时出现时，`y2` 的刻度会和 `y` 对齐，只画一套网格线；两条轴都有负值时，0 也会落在同一位置，柱子从同一条基线画起。

- `min`、`max` 固定坐标轴的范围；不设置时取数据的范围，纵轴还会向外取到整齐的刻度值。
- `format` 格式化刻度文字，收到的值在数值轴上是数字，时间轴上是 `Date`，类目轴上是类目的文字。不设置时，数值按当前语言格式化，较大的数会写成“12万”这样的短格式。
- `ticks` 是大致的刻度数量，也可以是具体的刻度值数组。刻度文字放不下时会自动减少刻度。
- `type="log"` 用对数刻度，适合跨越几个数量级的数据。对数轴上的柱子从轴的起点开始画，小于等于 0 的值不画，开发环境下会提示。
- `grid` 控制网格线，默认只有 `y` 有（只有 `y2` 时是 `y2`）；`title` 是坐标轴的标题；`hidden` 保留坐标轴的范围但不显示。

## 自定义系列

`defineChartSeries` 用来定义自己的系列组件。它和内置系列一样放在 `DouChart` 里，共用坐标轴、堆叠、图例和配色，只需要说明两件事：坐标轴怎样包含它的数据（`zero`、`band`、`inset`），以及怎样画出来。

<DocDemo src="chart/custom" />

```ts
defineChartSeries({
  type: 'lollipop', // 组件名为 DouChartLollipop，图例里的类名为 is-lollipop
  zero: true, // 数值轴包含 0
  stackable: false, // 是否支持 stack
  band: false, // 是否像柱子一样在每个位置并排分配空间
  inset: (series) => 0, // 每个点周围需要留出的像素，比如气泡的半径
  props: { radius: { type: Number, default: 5 } }, // 自己的属性
  draw(painter, series, view) {},
})
```

`draw` 收到三个参数：

- `painter`：canvas 2D 上下文的一部分方法，只通过它绘制。
- `series`：读取好的数据。`series.x.values` 是横轴的值（类目轴上是类目的序号），`series.top` 是要画的值（堆叠时是这一段的顶端），`series.base` 是堆叠时这一段的底端，`series.rows` 是原始的行数据，`series.props` 是组件的属性，`series.color` 是计算好的颜色。
- `view`：`point(x, value)` 返回这个值画在哪里，`[left, top]`，竖向和横向都一样，自定义系列一般只用它；`x`、`y` 是两个比例尺，`map` 把值换算成沿轴的像素；`horizontal` 表示横向；`band` 是每个位置的宽度（像素）；`plot` 是绘图区域。

内置的折线、面积、柱状和散点系列也通过同一个接口实现。

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
| `horizontal` | x 轴放在左侧，数值放在底部         | `boolean`                                   | `false`            |
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
| `axis`          | 对应的数值轴                       | `'y' \| 'y2'`                               | `'y'`                    |
| `smooth`        | 画成平滑曲线                       | `boolean`                                   | `false`                  |
| `dots`          | 显示数据点                         | `boolean \| 'auto'`                         | `'auto'`，面积图 `false` |
| `dashed`        | 画成虚线                           | `boolean`                                   | `false`                  |
| `line-width`    | 线宽，单位 px                      | `number`                                    | `2`                      |
| `connect-nulls` | 跨过缺失的值连线                   | `boolean`                                   | `false`                  |
| `hidden`        | 隐藏系列，保留它的颜色和位置       | `boolean`                                   | `false`                  |
| `stack`         | 堆叠分组，名称相同的叠在一起       | `string \| boolean`                         | —                        |

### Bar Props

`y`、`name`、`data`、`x`、`color`、`tone`、`axis`、`hidden` 和折线图相同。

| 名称     | 说明                         | 类型                | 默认值 |
| -------- | ---------------------------- | ------------------- | ------ |
| `stack`  | 堆叠分组，名称相同的叠在一起 | `string \| boolean` | —      |
| `radius` | 柱子末端的圆角，单位 px      | `number`            | `2`    |

### Scatter Props

`y`、`name`、`data`、`x`、`color`、`tone`、`axis`、`hidden` 和折线图相同。

| 名称     | 说明                                            | 类型                                        | 默认值             |
| -------- | ----------------------------------------------- | ------------------------------------------- | ------------------ |
| `size`   | 每个点的大小：字段名，或从行取值的函数          | `string \| (row, index: number) => unknown` | —                  |
| `radius` | 圆点半径，单位 px；有 `size` 时是最大气泡的半径 | `number`                                    | `3.5`，气泡为 `24` |

### Pie Props

| 名称           | 说明                                 | 类型                                        | 默认值        |
| -------------- | ------------------------------------ | ------------------------------------------- | ------------- |
| `value`        | 每一块的值：字段名，或从行取值的函数 | `string \| (row, index: number) => unknown` | —             |
| `label`        | 每一块的名称                         | `string \| (row, index: number) => unknown` | 图表的 `x`    |
| `data`         | 饼图自己的行数据                     | `object[]`                                  | 图表的 `data` |
| `name`         | 饼图的名称，读屏时读在最前面         | `string`                                    | —             |
| `color`        | 每一块的颜色：CSS 颜色或语气色名称   | `string \| (row, index: number) => string`  | 色板的彩色    |
| `inner-radius` | 中间空洞占半径的比例，`0` 是饼图     | `number`                                    | `0`           |

### Pie Slots

| 名称      | 说明                       |
| --------- | -------------------------- |
| `default` | 显示在环形图空洞中间的内容 |

### defineChartSeries

| 选项        | 说明                                               | 类型                              |
| ----------- | -------------------------------------------------- | --------------------------------- |
| `type`      | 系列类型，组件名为 `DouChart` 加上首字母大写的类型 | `string`                          |
| `zero`      | 数值轴包含 0                                       | `boolean`                         |
| `stackable` | 支持 `stack` 堆叠                                  | `boolean`                         |
| `band`      | 在每个位置并排分配空间，x 轴两端留出半个位置       | `boolean`                         |
| `inset`     | 每个点周围需要的空间（像素），坐标轴会放宽到能放下 | `(series) => number`              |
| `props`     | 组件自己的属性，写法和 Vue 组件的 `props` 相同     | `object`                          |
| `draw`      | 绘制                                               | `(painter, series, view) => void` |

### Axis Props

| 名称     | 说明                     | 类型                                          | 默认值                      |
| -------- | ------------------------ | --------------------------------------------- | --------------------------- |
| `for`    | 哪条轴                   | `'x' \| 'y' \| 'y2'`                          | —                           |
| `type`   | 刻度类型                 | `'linear' \| 'log' \| 'time' \| 'category'`   | x 轴按数据判断，数值轴线性  |
| `min`    | 起点                     | `number \| string \| Date`                    | 数据的最小值                |
| `max`    | 终点                     | `number \| string \| Date`                    | 数据的最大值                |
| `zero`   | 数值轴包含 0             | `boolean`                                     | 有面积图、柱状图时为 `true` |
| `nice`   | 两端取到整齐的刻度值     | `boolean`                                     | 数值轴 `true`，x 轴 `false` |
| `ticks`  | 刻度数量，或具体的刻度值 | `number \| (number \| string \| Date)[]`      | 按尺寸计算                  |
| `format` | 格式化刻度文字           | `(value: number \| Date \| string) => string` | —                           |
| `grid`   | 显示网格线               | `boolean`                                     | `y` 为 `true`               |
| `title`  | 标题                     | `string`                                      | —                           |
| `hidden` | 隐藏坐标轴，保留它的范围 | `boolean`                                     | `false`                     |

### CSS 变量

| 变量                   | 说明                                                   |
| ---------------------- | ------------------------------------------------------ |
| `--dou-chart-grid`     | 网格线颜色                                             |
| `--dou-chart-baseline` | 横轴和 0 刻度线的颜色                                  |
| `--dou-chart-label`    | 刻度文字颜色                                           |
| `--dou-chart-title`    | 坐标轴标题颜色                                         |
| `--dou-chart-surface`  | 图表所在的背景色，用于数据点的描边和饼图各块之间的间隔 |

### 读屏

根元素是 `role="img"`，名称是自动生成的概要：x 轴的范围（横向图读作“纵轴”），以及每个系列的名称、数据点个数、最小值和最大值。数值按对应坐标轴的 `format` 读出，和刻度文字一致。可以用 `aria-label` 替换。
