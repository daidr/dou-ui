# Progress 进度条

展示任务的完成进度。

## 基础用法

<DocDemo src="progress/basic" column style="max-width: 420px" />

`max` 默认 `100`；超出范围的值会被限制在轨道内。

## 语气与粗细

<DocDemo src="progress/tone-weight" column style="max-width: 420px" />

## 不确定进度

不传 `value` 时进度条变为不确定状态。

<DocDemo src="progress/indeterminate" column style="max-width: 420px" />

## 读屏

带有 `role="progressbar"` 与 `aria-valuemin` / `aria-valuemax` / `aria-valuenow`；不确定时不设 `aria-valuenow`。没有可见标签时用 `label` 命名。

## API

### Props

| 名称        | 说明                       | 类型                   | 默认值      |
| ----------- | -------------------------- | ---------------------- | ----------- |
| `value`     | 当前值；不传则为不确定状态 | `number`               | —           |
| `max`       | 最大值                     | `number`               | `100`       |
| `tone`      | 语气                       | `Tone`                 | `'neutral'` |
| `size`      | 粗细：4 / 6 / 8px          | `'sm' \| 'md' \| 'lg'` | `'md'`      |
| `showValue` | 在末尾显示百分比           | `boolean`              | `false`     |
| `label`     | 读屏标签                   | `string`               | —           |

### Slots

| 名称    | 说明                                    |
| ------- | --------------------------------------- |
| `value` | 替换百分比，参数为 `{ value, percent }` |

### CSS 变量

| 变量                    | 说明     |
| ----------------------- | -------- |
| `--dou-progress-tone`   | 进度条色 |
| `--dou-progress-track`  | 轨道色   |
| `--dou-progress-height` | 粗细     |
