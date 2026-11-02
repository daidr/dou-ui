# 图表

`@dou-ui/chart` 用于绘制折线图、柱状图、饼图等统计图表。一个图表由外壳 `DouChart` 和写在里面的系列、坐标轴组成。

完整的页面示例见区块[经营看板](../blocks/business)、[实时监控](../blocks/monitoring)和[门店对比](../blocks/compare)。

## 安装

图表是单独的包，需要和 `dou-ui` 一起安装：

```sh
bun add dou-ui @dou-ui/chart
```

引入样式，再注册用到的组件：

```ts
import 'dou-ui/style.css'
import '@dou-ui/chart/style.css'
import { DouChart, DouChartAxis, DouChartBar, DouChartLine } from '@dou-ui/chart'

app.use(DouChart).use(DouChartAxis).use(DouChartLine).use(DouChartBar)
```

## 基础用法

`data` 是一组行数据，`x` 指定横轴使用哪个字段。系列组件用 `y` 指定纵轴的字段，`name` 设置系列名称。

<DocDemo src="chart/basic" />

- 宽度跟随容器，`height` 设置高度，默认 320px。
- 没有写坐标轴时，自动显示底部的横轴和左侧的纵轴。
- 只有一个系列时使用中性色。

系列画在 canvas 上，刻度文字、图例等是页面中的普通文字，跟随主题的字体和颜色。

## 多个系列

多个系列按书写顺序依次使用色板中的颜色，图表下方自动显示图例。

<DocDemo src="chart/multiple" />

- `color` 指定任意 CSS 颜色；颜色有明确含义时（比如错误数），用 `tone` 取语气色。
- `:legend="false"` 隐藏图例；只有一个系列时，`legend` 可以显示图例。

图例的用法见[提示框与图例](./interaction#图例)，配色见[外观](./theme)。

## 组合图

不同类型的系列可以放在同一个图表里，比如柱状图配合折线图，再用第二条数值轴显示另一种单位。

<DocDemo src="chart/combo" />

第二条数值轴的用法见[坐标轴](./axes#第二条数值轴)。饼图、雷达图、漏斗图、矩形树图、旭日图和仪表盘需要单独放在一个图表里。

## 图表类型

| 组件                                               | 用途                   | 文档                               |
| -------------------------------------------------- | ---------------------- | ---------------------------------- |
| `DouChartLine`、`DouChartArea`                     | 折线图、面积图         | [折线图与面积图](./line)           |
| `DouChartBar`、`DouChartWaterfall`                 | 柱状图、瀑布图         | [柱状图](./bar)                    |
| `DouChartHistogram`、`DouChartBoxplot`             | 直方图、箱线图         | [直方图与箱线图](./distribution)   |
| `DouChartScatter`、`DouChartHeatmap`               | 散点图、气泡图、热力图 | [散点图与热力图](./scatter)        |
| `DouChartPie`                                      | 饼图、环形图、玫瑰图   | [饼图](./pie)                      |
| `DouChartTreemap`、`DouChartSunburst`              | 矩形树图、旭日图       | [层级数据](./hierarchy)            |
| `DouChartRadar`、`DouChartFunnel`、`DouChartGauge` | 雷达图、漏斗图、仪表盘 | [雷达图、漏斗图与仪表盘](./others) |

内置系列不够用时，可以用 `defineChartSeries` 定义自己的系列，见[自定义系列](./custom)。

## 没有数据

所有系列都没有数值时，图表不画坐标轴，只在中间显示“没有数据”。`empty` 插槽可以替换这部分内容。

## 加载中

`loading` 为 `true` 时，图表变淡，中间显示加载图标，这时没有数据也不会显示“没有数据”。数据到达后把 `loading` 设回 `false`，已有的图表会过渡到新数据。

<DocDemo src="chart/loading" />

## 动画

图表第一次出现在屏幕上时有入场动画：柱子和面积从基线长出，折线从左到右画出，饼图沿顺时针展开。数据变化时，各个值移动到新的位置。

开启了减弱动效，或者数据点超过 2000 个时，图表直接显示最终的样子。

## API

### Chart Props

| 名称              | 说明                                                                  | 类型                                        | 默认值             |
| ----------------- | --------------------------------------------------------------------- | ------------------------------------------- | ------------------ |
| `data`            | 数据：行数组，或按列给的对象，见[大量数据](./performance)             | `object[] \| Record<string, ArrayLike>`     | `[]`               |
| `x`               | 横轴的值：字段名，或从行取值的函数                                    | `string \| (row, index: number) => unknown` | 行的序号           |
| `height`          | 高度，数字按 px 计算                                                  | `number \| string`                          | `320`              |
| `horizontal`      | 横向：x 轴在左侧，数值在底部，见[柱状图](./bar#横向)                  | `boolean`                                   | `false`            |
| `legend`          | 显示或隐藏图例                                                        | `boolean`                                   | 多于一个系列时显示 |
| `legendPlacement` | 图例的位置，见[图例](./interaction#图例的位置)                        | `'top' \| 'bottom' \| 'right'`              | `'bottom'`         |
| `palette`         | 这个图表自己的配色，见[外观](./theme#自定义配色)                      | `string[]`                                  | 主题的 8 种颜色    |
| `patterns`        | 给有填充的系列加上图案，见[外观](./theme#图案填充)                    | `boolean`                                   | `false`            |
| `v-model:table`   | 在图表的位置显示数据表，见[无障碍](./accessibility#数据表)            | `boolean`                                   | `false`            |
| `loading`         | 显示加载状态                                                          | `boolean`                                   | `false`            |
| `ariaLabel`       | 读屏读出的名称，替换自动生成的概要                                    | `string`                                    | —                  |
| `messages`        | 替换语言包里的文字                                                    | `Partial<ChartMessages>`                    | —                  |
| `ssrWidth`        | 服务端渲染时按这个宽度绘制（px），见[服务端渲染](./export#服务端渲染) | `number`                                    | `640`              |

### Chart Events

| 名称           | 说明                                                                   | 参数                      |
| -------------- | ---------------------------------------------------------------------- | ------------------------- |
| `select`       | 点击柱子、数据点或饼图的一块，见[点击与悬停](./interaction#点击与悬停) | `ChartPointEvent`         |
| `hover`        | 提示框换到另一处内容；收起时参数为 `null`                              | `ChartPointEvent \| null` |
| `update:table` | 在数据表里按 `Esc` 关闭时触发                                          | `false`                   |

### Chart Exposes

| 名称        | 说明                              |
| ----------- | --------------------------------- |
| `exportSVG` | 导出 SVG 文本，见[导出](./export) |
| `exportPNG` | 导出 PNG 图片，见[导出](./export) |

### Chart Slots

| 名称      | 说明                 |
| --------- | -------------------- |
| `default` | 系列、坐标轴等组件   |
| `empty`   | 没有数据时显示的内容 |
