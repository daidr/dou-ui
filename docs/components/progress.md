# Progress 进度条

展示任务的完成进度，可以是条形、圆环或仪表盘。

## 基础用法

<DocDemo src="progress/basic" column style="max-width: 420px" />

`max` 默认 `100`；超出范围的值会被限制在轨道内。

## 语气与粗细

<DocDemo src="progress/tone-weight" column style="max-width: 420px" />

## 不确定进度

不传 `value` 时进度条变为不确定状态。

<DocDemo src="progress/indeterminate" column style="max-width: 420px" />

## 环形

`type="circle"` 画成圆环，`width` 是直径（默认 96px），粗细仍由 `size` 决定，也可以用 `stroke-width` 直接给像素值。`show-value` 的百分比显示在环中间，`value` 插槽可以换成任意内容。不传 `value` 时圆环转动表示进行中。

<DocDemo src="progress/circle" column />

## 仪表盘

`type="dashboard"` 是底部留出四分之一缺口的圆环，从左下角开始走，适合展示用量、占比这类有上限的指标。

<DocDemo src="progress/dashboard" />

## 条内文字与分段颜色

`text-inside` 把百分比放进条形进度条里，进度条会加粗到能放下文字；进度太小放不下时，文字显示在进度条末端之后。

`color` 用自己的颜色代替语气色，可以是任意 CSS 颜色，也可以按进度分段：传入 `{ percent, color }` 数组时，每一段在进度不超过 `percent` 时生效；传函数则根据百分比返回颜色。圆环和仪表盘同样适用。使用自定义颜色时，条内文字为白色。

<DocDemo src="progress/text-inside" />

## 读屏

带有 `role="progressbar"` 与 `aria-valuemin` / `aria-valuemax` / `aria-valuenow`；不确定时不设 `aria-valuenow`。没有可见标签时用 `label` 命名。

## API

### Props

| 名称          | 说明                           | 类型                                                             | 默认值      |
| ------------- | ------------------------------ | ---------------------------------------------------------------- | ----------- |
| `value`       | 当前值；不传则为不确定状态     | `number`                                                         | —           |
| `max`         | 最大值                         | `number`                                                         | `100`       |
| `tone`        | 语气                           | `Tone`                                                           | `'neutral'` |
| `type`        | 条形、圆环或仪表盘             | `'line' \| 'circle' \| 'dashboard'`                              | `'line'`    |
| `size`        | 粗细：4 / 6 / 8px              | `'sm' \| 'md' \| 'lg'`                                           | `'md'`      |
| `width`       | 圆环直径，px                   | `number`                                                         | `96`        |
| `strokeWidth` | 圆环粗细，px，优先于 `size`    | `number`                                                         | —           |
| `showValue`   | 在末尾（圆环为中间）显示百分比 | `boolean`                                                        | `false`     |
| `textInside`  | 百分比放在条形进度条里         | `boolean`                                                        | `false`     |
| `color`       | 自定义颜色，或按进度分段的颜色 | `string \| ProgressColorStop[] \| ((percent: number) => string)` | —           |
| `label`       | 读屏标签                       | `string`                                                         | —           |

### Slots

| 名称    | 说明                                    |
| ------- | --------------------------------------- |
| `value` | 替换百分比，参数为 `{ value, percent }` |

### CSS 变量

| 变量                    | 说明         |
| ----------------------- | ------------ |
| `--dou-progress-tone`   | 进度条色     |
| `--dou-progress-track`  | 轨道色       |
| `--dou-progress-height` | 粗细         |
| `--dou-progress-on`     | 条内文字颜色 |
