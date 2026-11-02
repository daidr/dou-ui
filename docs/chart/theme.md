# 外观

图表的颜色都来自主题，切换亮色、暗色主题时图表会自动重绘。

## 主题色板

系列颜色是 `--dou-color-chart-1` 到 `--dou-color-chart-8`。第 1 个是中性色，其余是低饱和的色相，明度互相错开，常见的色觉障碍下也能区分。

<TokenSwatches group="chart" />

## 自定义配色

`palette` 给一个图表指定自己的配色，系列和饼图的各块按顺序使用，数量不够时从头循环。每一项是 CSS 颜色或语气色名称（`neutral`、`danger` 等）。

<DocDemo src="chart/palette" />

- 系列自己的 `color` 和 `tone` 优先于 `palette`。
- 配色只影响这个图表。

固定的颜色往往不能在亮色和暗色背景上都看清，可以按主题分别指定：

- 写成 `color-mix(in oklab, 深色 calc(100% * var(--dou-scheme-dark)), 浅色)`。`--dou-scheme-dark` 在亮色主题里是 `0`，暗色主题里是 `1`，见[亮色与暗色](/guide/theming#亮色与暗色)。上面的示例用的是这种写法，切换到暗色主题可以看到效果。
- 写成 `var(--my-brand)`，在自己的样式里按主题定义这个变量。

## 图案填充

`patterns` 给每个有填充的系列（柱状图、直方图、面积图）和饼图的每一块加上不同的图案，图例里也显示图案。打印成黑白、颜色接近或者有色觉障碍时，靠图案也能分清各个系列。

<DocDemo src="chart/patterns" />

- 图案按系列的顺序依次分配。
- 系列的 `pattern` 指定自己的图案：`diagonal`、`dots`、`crosshatch`、`horizontal`、`backslash`、`grid`、`vertical`，设为 `none` 时不加图案。
- 瀑布图、箱线图和仪表盘不加图案。

## API

### CSS 变量

| 变量                           | 说明                                                   |
| ------------------------------ | ------------------------------------------------------ |
| `--dou-color-chart-1` … `8`    | 系列颜色，见[主题色板](#主题色板)                      |
| `--dou-chart-grid`             | 网格线颜色                                             |
| `--dou-chart-baseline`         | 横轴和 0 刻度线的颜色                                  |
| `--dou-chart-label`            | 刻度文字颜色                                           |
| `--dou-chart-title`            | 坐标轴标题颜色                                         |
| `--dou-chart-surface`          | 图表所在的背景色，用于数据点的描边和饼图各块之间的间隔 |
| `--dou-chart-range-ink`        | 区间条里缩略图的颜色                                   |
| `--dou-chart-marker`           | 中性色标注的线条颜色                                   |
| `--dou-chart-track`            | 仪表盘轨道的颜色                                       |
| `--dou-chart-gauge-value-size` | 仪表盘中间数值的字号，默认 28px                        |
